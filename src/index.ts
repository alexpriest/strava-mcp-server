#!/usr/bin/env node

import dotenv from 'dotenv';
import { createStravaMCPServer } from './server.js';
import { initializeStreamableTransport } from './transports/streamable.js';
import { ConfigurationError } from './utils/errors.js';

dotenv.config();

async function main() {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    // 0.0.0.0 for Railway/production, 127.0.0.1 for local development.
    const host = process.env.HOST || (process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : '127.0.0.1');
    const mcpPath = process.env.MCP_PATH || '/mcp';
    const authToken = process.env.AUTH_TOKEN;
    const oauthPasscode = process.env.MCP_OAUTH_PASSCODE;

    // PUBLIC_URL is the externally-reachable origin used for OAuth metadata.
    // On Railway, derive from RAILWAY_PUBLIC_DOMAIN if not set explicitly.
    const publicUrl = process.env.PUBLIC_URL
      || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined);

    // Validate Strava OAuth config — these are required for the server to function.
    // We don't fail-fast on missing tokens (that's expected before /strava/authorize),
    // but the client_id/secret/redirect_uri must be set for the flow to work.
    const stravaClientId = process.env.STRAVA_CLIENT_ID;
    const stravaClientSecret = process.env.STRAVA_CLIENT_SECRET;
    const stravaRedirectUri = process.env.STRAVA_REDIRECT_URI;
    if (!stravaClientId || !stravaClientSecret || !stravaRedirectUri) {
      console.error('WARNING: STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REDIRECT_URI not set.');
      console.error('  The server will start but /strava/authorize will return an error until these are configured.');
    }

    console.error('Initializing Strava MCP Server...');

    const serverFactory = () => createStravaMCPServer();

    await initializeStreamableTransport(serverFactory, {
      port,
      host,
      mcpPath,
      authToken,
      publicUrl,
      oauthPasscode,
    });

    console.error('Strava MCP Server initialized successfully!');
  } catch (error) {
    console.error('Failed to start Strava MCP Server:');
    if (error instanceof ConfigurationError) {
      console.error(`Configuration Error: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(error.message);
      console.error(error.stack);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.error('\nShutting down Strava MCP Server...');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.error('\nShutting down Strava MCP Server...');
  process.exit(0);
});

main();
