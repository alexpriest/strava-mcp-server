// Error handling utilities for the Strava MCP server

export class StravaAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'StravaAPIError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class StravaAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StravaAuthError';
  }
}

export function handleToolError(error: unknown): string {
  if (error instanceof StravaAuthError) {
    return `Strava not connected: ${error.message}\n\nVisit /strava/authorize on the deployed server to connect your Strava account.`;
  }
  if (error instanceof StravaAPIError) {
    if (error.statusCode === 401) {
      return `Strava token expired or revoked — visit /strava/authorize on the server to reconnect. (Underlying: ${error.message})`;
    }
    if (error.statusCode === 403) {
      return `Strava 403 Forbidden — likely a missing scope. The server requests read, read_all, profile:read_all, profile:write, activity:read, activity:read_all, activity:write, segment:write. Re-auth at /strava/authorize if scopes were upgraded. (Underlying: ${error.message})`;
    }
    return `Strava API Error: ${error.message}${
      error.statusCode ? ` (Status: ${error.statusCode})` : ''
    }`;
  }
  if (error instanceof ValidationError) {
    return `Validation Error: ${error.message}${
      error.details ? `\nDetails: ${JSON.stringify(error.details, null, 2)}` : ''
    }`;
  }
  if (error instanceof ConfigurationError) {
    return `Configuration Error: ${error.message}`;
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Unknown error: ${String(error)}`;
}
