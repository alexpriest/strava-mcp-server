/**
 * Route tools.
 */
import { StravaClient } from '../strava/client.js';
import { handleToolError } from '../utils/errors.js';
import { formatRoute, formatRoutes } from '../utils/formatters.js';

export function getRouteTools() {
  return [
    {
      name: 'list-athlete-routes',
      description: "List an athlete's saved routes. Defaults to the connected athlete.",
      inputSchema: {
        type: 'object',
        properties: {
          athlete_id: { type: 'string', description: 'Optional Strava athlete ID. Defaults to the connected athlete.' },
          page: { type: 'number' },
          per_page: { type: 'number' },
        },
      },
    },
    {
      name: 'get-route',
      description: 'Get details for a route by ID (distance, elevation gain, type, description).',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Strava route ID.' } },
        required: ['id'],
      },
    },
    {
      name: 'export-route-gpx',
      description: 'Export a route as GPX (XML). Returns the raw GPX file body — can be large for long routes.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Strava route ID.' } },
        required: ['id'],
      },
    },
    {
      name: 'export-route-tcx',
      description: 'Export a route as TCX (XML). Returns the raw TCX file body — can be large for long routes.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Strava route ID.' } },
        required: ['id'],
      },
    },
  ];
}

export async function handleRouteToolCall(request: any, client: StravaClient) {
  try {
    switch (request.params.name) {
      case 'list-athlete-routes': {
        const a = (request.params.arguments ?? {}) as { athlete_id?: string; page?: number; per_page?: number };
        let athleteId: string | number | undefined = a.athlete_id;
        if (!athleteId) {
          const me = await client.getAthlete();
          athleteId = me.id;
        }
        const routes = await client.listAthleteRoutes(athleteId, { page: a.page, per_page: a.per_page });
        return { content: [{ type: 'text', text: formatRoutes(routes) }] };
      }
      case 'get-route': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return errText('id is required');
        const r = await client.getRoute(a.id);
        return { content: [{ type: 'text', text: formatRoute(r) }] };
      }
      case 'export-route-gpx': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return errText('id is required');
        const gpx = await client.exportRouteGpx(a.id);
        return { content: [{ type: 'text', text: gpx }] };
      }
      case 'export-route-tcx': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return errText('id is required');
        const tcx = await client.exportRouteTcx(a.id);
        return { content: [{ type: 'text', text: tcx }] };
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
