import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { StravaClient } from './strava/client.js';
import { getActivityTools, handleActivityToolCall } from './tools/activities.js';
import { getAthleteTools, handleAthleteToolCall } from './tools/athlete.js';
import { getClubTools, handleClubToolCall } from './tools/clubs.js';
import { getGearTools, handleGearToolCall } from './tools/gear.js';
import { getRouteTools, handleRouteToolCall } from './tools/routes.js';
import { getSegmentTools, handleSegmentToolCall } from './tools/segments.js';
import { getSegmentEffortTools, handleSegmentEffortToolCall } from './tools/segmentEfforts.js';
import { getStreamTools, handleStreamToolCall } from './tools/streams.js';
import { getUploadTools, handleUploadToolCall } from './tools/uploads.js';

/**
 * Create a fresh MCP Server instance. Strava credentials live on disk
 * (managed by src/strava/oauth.ts) and are read on demand by the client,
 * so no constructor config is needed beyond a fresh client.
 */
export function createStravaMCPServer(): Server {
  const client = new StravaClient();

  const server = new Server(
    {
      name: 'strava-mcp-server',
      version: '2.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const allTools = [
    ...getActivityTools(),
    ...getAthleteTools(),
    ...getClubTools(),
    ...getGearTools(),
    ...getRouteTools(),
    ...getSegmentTools(),
    ...getSegmentEffortTools(),
    ...getStreamTools(),
    ...getUploadTools(),
  ];

  const handlers = [
    handleActivityToolCall,
    handleAthleteToolCall,
    handleClubToolCall,
    handleGearToolCall,
    handleRouteToolCall,
    handleSegmentToolCall,
    handleSegmentEffortToolCall,
    handleStreamToolCall,
    handleUploadToolCall,
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    for (const handler of handlers) {
      const result = await handler(request, client);
      if (result) return result;
    }
    return {
      content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  });

  return server;
}
