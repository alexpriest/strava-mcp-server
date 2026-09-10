# strava-mcp-server

A Strava MCP server over Streamable HTTP and OAuth 2.1, installable as a claude.ai connector.

## Status

Shipped — deployed on Railway as a claude.ai custom connector.

## License

Not licensed for reuse.

Built on the same pattern as the [Hevy MCP server](../hevy-mcp-server) — TypeScript + Express + `@modelcontextprotocol/sdk`, deployable to Railway, claude.ai-compatible.

## Tools

- `get-recent-activities` — list recent Strava activities (defaults to last 30 days)
- `get-activity` — detailed activity by ID, with mile/km splits and laps
- `get-athlete` — connected athlete profile
- `get-athlete-stats` — recent / YTD / all-time totals for runs, rides, swims
- `get-activity-zones` — heart rate / power zone distribution for an activity

## Architecture

Two OAuth flows running side by side:

1. **MCP-side OAuth** (`src/oauth/mcpOAuth.ts`) — what claude.ai authenticates against. Passcode-gated approval page issues access tokens that gate `/mcp`.
2. **Strava-side OAuth** (`src/strava/oauth.ts`) — what *this server* uses to call the Strava API. Two-leg flow: visit `/strava/authorize` once to grant access; tokens persist to disk and auto-refresh.

The MCP `/mcp` endpoint accepts either:
- A legacy static `AUTH_TOKEN` (for local Claude Code usage), or
- An OAuth Bearer token issued by the MCP-side OAuth (for claude.ai).

## Deployment to Railway

### 1. Create a Strava API application

Visit <https://www.strava.com/settings/api> and create an application:
- **Application Name**: e.g. "Alex's MCP Server"
- **Category**: anything
- **Website**: your Railway URL or any URL
- **Authorization Callback Domain**: the bare domain part of your Railway URL (e.g. `strava-mcp-production-xxxx.up.railway.app`) — Strava only takes the domain here, not the full path.

After saving, note the **Client ID** and **Client Secret**.

### 2. Set Railway environment variables

```
STRAVA_CLIENT_ID=<from strava>
STRAVA_CLIENT_SECRET=<from strava>
STRAVA_REDIRECT_URI=https://<your-railway-domain>/strava/callback
MCP_OAUTH_PASSCODE=<some passcode you'll type into the approval page>
AUTH_TOKEN=<optional — for legacy local Claude Code clients>
PUBLIC_URL=https://<your-railway-domain>
```

`PUBLIC_URL` is auto-derived from `RAILWAY_PUBLIC_DOMAIN` if not set, but setting it explicitly is safer.

### 3. Deploy

```bash
cd /Users/alex/Code/projects/strava-mcp-server
railway up
```

### 4. One-time Strava connection

After deploy, visit:

```
https://<your-railway-domain>/strava/authorize
```

You'll be sent to Strava's consent page. After approving, Strava redirects back to `/strava/callback` and the server saves the access + refresh tokens to disk (`./strava-tokens.json`).

Verify with:

```
https://<your-railway-domain>/strava/status
```

Should return `{ "connected": true, "athleteName": "...", ... }`.

### 5. Add to claude.ai

In claude.ai → Settings → Connectors → Add custom connector, point at:

```
https://<your-railway-domain>/mcp
```

claude.ai will discover the OAuth metadata, register itself dynamically, and prompt you for the `MCP_OAUTH_PASSCODE` you set above.

## Important caveats

- **Railway redeploys wipe Strava tokens.** The filesystem is ephemeral. After every deploy, re-visit `/strava/authorize` to reconnect. (For v1 this is fine; the refresh token is long-lived for you to grab again easily.)
- **Strava rate limits** are 200 requests / 15 minutes and 2000 / day per app. Don't hammer it.
- The MCP OAuth tokens are also in-memory only — a Railway redeploy invalidates the claude.ai connector and you'll need to reconnect.

## Local development

```bash
npm install
npm run build

STRAVA_CLIENT_ID=fake \
STRAVA_CLIENT_SECRET=fake \
STRAVA_REDIRECT_URI=http://localhost:4848/strava/callback \
PORT=4848 \
PUBLIC_URL=http://localhost:4848 \
MCP_OAUTH_PASSCODE=test123 \
MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=true \
node dist/index.js
```

Then poke at:
- `http://localhost:4848/health`
- `http://localhost:4848/.well-known/oauth-authorization-server`
- `http://localhost:4848/.well-known/oauth-protected-resource/mcp`
- `http://localhost:4848/strava/authorize` (will fail without real Strava creds — expected)

## File layout

```
src/
  index.ts                 — entrypoint
  server.ts                — MCP Server factory (registers tools)
  oauth/mcpOAuth.ts        — MCP-side OAuth 2.1 (claude.ai compatibility)
  strava/
    client.ts              — Strava API v3 client
    oauth.ts               — Strava OAuth 2.0 flow + token persistence
    types.ts               — Strava API response types
  transports/streamable.ts — Express app + Streamable HTTP transport
  tools/
    activities.ts          — get-recent-activities, get-activity, get-activity-zones
    athlete.ts             — get-athlete, get-athlete-stats
  utils/
    formatters.ts          — distance/duration/pace formatting
    errors.ts              — error classes + handleToolError
    security.ts            — secureCompare, sanitizeErrorMessage
    logger.ts              — structured JSON logger
```
