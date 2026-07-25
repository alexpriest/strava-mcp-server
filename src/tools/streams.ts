/**
 * Stream tools — for routes, segments, segment efforts.
 * (Activity streams live with the activity tools to keep that endpoint set tight.)
 */
import { StravaClient } from '../strava/client.js';
import { handleToolError } from '../utils/errors.js';
import { formatStreamSet } from '../utils/formatters.js';

export function getStreamTools() {
  return [
    {
      name: 'get-route-streams',
      description:
        'Get streams for a route. Returns distance, latlng, altitude streams for the planned route.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Strava route ID.' } },
        required: ['id'],
      },
    },
    {
      name: 'get-segment-streams',
      description:
        'Get streams for a segment (latlng, distance, altitude across the segment).',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Strava segment ID.' } },
        required: ['id'],
      },
    },
    {
      name: 'get-segment-effort-streams',
      description:
        'Get streams for a specific segment effort (e.g. heart rate, watts, velocity through the segment).',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Strava segment effort ID.' } },
        required: ['id'],
      },
    },
  ];
}

export async function handleStreamToolCall(request: any, client: StravaClient) {
  try {
    switch (request.params.name) {
      case 'get-route-streams': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return errText('id is required');
        const s = await client.getRouteStreams(a.id);
        return { content: [{ type: 'text', text: formatStreamSet(s) }] };
      }
      case 'get-segment-streams': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return errText('id is required');
        const s = await client.getSegmentStreams(a.id);
        return { content: [{ type: 'text', text: formatStreamSet(s) }] };
      }
      case 'get-segment-effort-streams': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return errText('id is required');
        const s = await client.getSegmentEffortStreams(a.id);
        return { content: [{ type: 'text', text: formatStreamSet(s) }] };
      }
      default:
        return null;
    }
  } catch (error) {
    return { content: [{ type: 'text', text: handleToolError(error) }], isError: true };
  }
}

function errText(msg: string) {
  return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
}
