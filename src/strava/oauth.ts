/**
 * Strava OAuth 2.0 flow — separate from the MCP-side OAuth in src/oauth/mcpOAuth.ts.
 *
 * Two-leg pattern:
 *   1. User visits /strava/authorize on this server → we redirect to Strava's authorize page.
 *   2. Strava redirects user back to /strava/callback with a code → we POST it to Strava /token,
 *      get back access + refresh tokens, persist to disk.
 *
 * Once authorized, MCP tool calls use getValidAccessToken() which auto-refreshes when expired.
 *
 * Tokens persist to ./strava-tokens.json (cwd). Railway's filesystem is ephemeral —
 * a redeploy wipes tokens and re-auth is required. Acceptable for v1.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { StravaAuthError } from '../utils/errors.js';
import { StravaTokens } from './types.js';

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

// Persist to a Railway volume if attached (RAILWAY_VOLUME_MOUNT_PATH=/data)
// so tokens survive redeploys. Falls back to cwd locally.
const TOKENS_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd();
const TOKENS_FILE = path.join(TOKENS_DIR, 'strava-tokens.json');
// Refresh 5 minutes before stated expiry so requests in flight don't get a 401.
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Strava scopes for the full toolset:
//   read              — public profile / segments
//   read_all          — private segments, routes, profile
//   profile:read_all  — full athlete details (weight, FTP, gear)
//   profile:write     — update athlete weight
//   activity:read     — non-private activities (default activities scope)
//   activity:read_all — read private activities, plus required for PUT /activities (private)
//   activity:write    — create / update activities, uploads
//   segment:write     — star/unstar segments
// Strava only defines these scopes — `segment:write` doesn't exist; star-segment
// uses `activity:write` per the API reference.
const STRAVA_SCOPES = [
  'read',
  'read_all',
  'profile:read_all',
  'profile:write',
  'activity:read',
  'activity:read_all',
  'activity:write',
];

// In-memory cache to avoid hitting disk on every API call.
let cachedTokens: StravaTokens | null = null;

// CSRF state for the authorize → callback round trip.
const STATE_TTL_MS = 60 * 60 * 1000; // 1 hour
const pendingStates = new Map<string, { expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingStates) if (v.expiresAt < now) pendingStates.delete(k);
}, 5 * 60 * 1000).unref?.();

function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function saveTokens(tokens: StravaTokens): Promise<void> {
  cachedTokens = tokens;
  try {
    await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
    logger.info('Strava tokens saved');
  } catch (err) {
    logger.error('Failed to write Strava tokens to disk', {}, err as Error);
    throw err;
  }
}

async function readTokens(): Promise<StravaTokens | null> {
  if (cachedTokens) return cachedTokens;
  try {
    const raw = await fs.readFile(TOKENS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as StravaTokens;
    cachedTokens = parsed;
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    logger.error('Failed to read Strava tokens', {}, err as Error);
    return null;
  }
}

export async function clearTokens(): Promise<void> {
  cachedTokens = null;
  try {
    await fs.unlink(TOKENS_FILE);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new StravaAuthError(`${name} is not configured`);
  return v;
}

/**
 * Express handler for GET /strava/authorize — kicks off the Strava OAuth flow.
 * After Alex completes Strava's consent screen, Strava redirects to /strava/callback.
 */
export function handleStravaAuthorize(_req: Request, res: Response): void {
  let clientId: string;
  let redirectUri: string;
  try {
    clientId = envOrThrow('STRAVA_CLIENT_ID');
    redirectUri = envOrThrow('STRAVA_REDIRECT_URI');
  } catch (err) {
    res.status(500).send(
      `<h1>Strava OAuth not configured</h1><p>${(err as Error).message}.</p>` +
      `<p>Set <code>STRAVA_CLIENT_ID</code>, <code>STRAVA_CLIENT_SECRET</code>, and <code>STRAVA_REDIRECT_URI</code> in the environment.</p>`
    );
    return;
  }

  const state = generateState();
  pendingStates.set(state, { expiresAt: Date.now() + STATE_TTL_MS });

  const url = new URL(STRAVA_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  // Strava expects a comma-separated scope string (NOT space-separated like RFC 6749).
  url.searchParams.set('scope', STRAVA_SCOPES.join(','));
  url.searchParams.set('approval_prompt', 'auto');
  url.searchParams.set('state', state);

  logger.info('Redirecting to Strava authorize', { state });
  res.redirect(url.toString());
}

/**
 * Express handler for GET /strava/callback.
 */
export async function handleStravaCallback(req: Request, res: Response): Promise<void> {
  const { code, state, error, scope } = req.query;

  if (error) {
    logger.error('Strava authorization error', { error });
    res.status(400).send(`<h1>Strava authorization failed</h1><p>${String(error)}</p>`);
    return;
  }
  if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
    res.status(400).send('Invalid callback parameters');
    return;
  }
  const pending = pendingStates.get(state);
  if (!pending) {
    res.status(400).send('Invalid state — likely a CSRF retry. Restart from /strava/authorize.');
    return;
  }
  if (pending.expiresAt < Date.now()) {
    pendingStates.delete(state);
    res.status(400).send('OAuth state expired. Restart from /strava/authorize.');
    return;
  }
  pendingStates.delete(state);

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (typeof scope === 'string') tokens.scope = scope;
    await saveTokens(tokens);
    res.send(`<!DOCTYPE html><html><head><title>Strava connected</title>
      <style>body{font-family:system-ui;max-width:520px;margin:60px auto;padding:24px;line-height:1.5}
      .ok{color:#10b981;font-size:22px;font-weight:600;margin-bottom:16px}
      .card{border:1px solid #e5e7eb;border-radius:12px;padding:20px;background:rgba(0,0,0,0.02)}</style>
      </head><body>
      <div class="ok">Strava connected!</div>
      <div class="card">
        <p>Athlete: <strong>${tokens.athlete?.firstname ?? ''} ${tokens.athlete?.lastname ?? ''}</strong> (id ${tokens.athlete?.id ?? '?'})</p>
        <p>Scopes: <code>${tokens.scope ?? '(unknown)'}</code></p>
        <p>You can close this window. The MCP server will use these credentials for Strava API calls.</p>
        <p style="color:#6b7280;font-size:13px">Note: Railway redeploys wipe these tokens. Re-visit <code>/strava/authorize</code> after a redeploy.</p>
      </div></body></html>`);
  } catch (err) {
    logger.error('Strava token exchange failed', {}, err as Error);
    res.status(500).send(`<h1>Token exchange failed</h1><pre>${(err as Error).message}</pre>`);
  }
}

async function exchangeCodeForTokens(code: string): Promise<StravaTokens> {
  const clientId = envOrThrow('STRAVA_CLIENT_ID');
  const clientSecret = envOrThrow('STRAVA_CLIENT_SECRET');
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  });
  const resp = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Strava /token returned ${resp.status}: ${text}`);
  }
  return (await resp.json()) as StravaTokens;
}

async function refreshTokens(refresh_token: string): Promise<StravaTokens> {
  const clientId = envOrThrow('STRAVA_CLIENT_ID');
  const clientSecret = envOrThrow('STRAVA_CLIENT_SECRET');
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token,
  });
  const resp = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Strava /token refresh returned ${resp.status}: ${text}`);
  }
  return (await resp.json()) as StravaTokens;
}

/**
 * Returns a valid Strava access token, refreshing if needed.
 * Throws StravaAuthError if the user has not yet connected Strava.
 */
export async function getValidAccessToken(): Promise<string> {
  const tokens = await readTokens();
  if (!tokens) {
    throw new StravaAuthError('No Strava tokens found. Visit /strava/authorize on the server to connect.');
  }
  // Strava's `expires_at` is unix EPOCH seconds.
  const expiresAtMs = tokens.expires_at * 1000;
  if (Date.now() < expiresAtMs - REFRESH_BUFFER_MS) {
    return tokens.access_token;
  }
  // Token is expired or expiring soon — refresh it.
  if (!tokens.refresh_token) {
    throw new StravaAuthError('Strava access token expired and no refresh token available. Re-auth at /strava/authorize.');
  }
  logger.info('Refreshing Strava access token');
  try {
    const refreshed = await refreshTokens(tokens.refresh_token);
    // Carry over scope (refresh response doesn't include scope).
    if (!refreshed.scope && tokens.scope) refreshed.scope = tokens.scope;
    if (!refreshed.athlete && tokens.athlete) refreshed.athlete = tokens.athlete;
    await saveTokens(refreshed);
    return refreshed.access_token;
  } catch (err) {
    logger.error('Strava token refresh failed', {}, err as Error);
    throw new StravaAuthError(`Failed to refresh Strava token: ${(err as Error).message}. Re-auth at /strava/authorize.`);
  }
}

/**
 * Returns connection status for /strava/status diagnostic endpoint.
 */
export async function getConnectionStatus(): Promise<{
  connected: boolean;
  athleteId?: number;
  athleteName?: string;
  scope?: string;
  expiresAt?: number;
  expired?: boolean;
}> {
  const tokens = await readTokens();
  if (!tokens) return { connected: false };
  const expiresAtMs = tokens.expires_at * 1000;
  return {
    connected: true,
    athleteId: tokens.athlete?.id,
    athleteName: tokens.athlete ? `${tokens.athlete.firstname ?? ''} ${tokens.athlete.lastname ?? ''}`.trim() : undefined,
    scope: tokens.scope,
    expiresAt: tokens.expires_at,
    expired: Date.now() >= expiresAtMs,
  };
}
