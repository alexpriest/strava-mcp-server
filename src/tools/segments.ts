/**
 * Segment tools.
 */
import { StravaClient } from '../strava/client.js';
import { handleToolError } from '../utils/errors.js';
import {
  formatSegmentDetailed,
  formatSegments,
  formatExploredSegments,
} from '../utils/formatters.js';

export function getSegmentTools() {
  return [
    {
      name: 'get-segment',
      description: 'Get detailed segment info by ID, including the connected athlete PR.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Strava segment ID.' } },
        required: ['id'],
      },
    },
    {
      name: 'explore-segments',
      description:
        'Explore popular segments inside a bounding box. bounds = [SW lat, SW lng, NE lat, NE lng]. Returns up to 10 segments.',
      inputSchema: {
        type: 'object',
        properties: {
          bounds: {
            type: 'array',
            items: { type: 'number' },
            minItems: 4,
            maxItems: 4,
            description: 'Bounding box [SW lat, SW lng, NE lat, NE lng].',
          },
          activity_type: { type: 'string', enum: ['running', 'riding'] },
          min_cat: { type: 'number', description: 'Min climb category (0-5). Riding only.' },
          max_cat: { type: 'number', description: 'Max climb category (0-5). Riding only.' },
        },
        required: ['bounds'],
      },
    },
    {
      name: 'star-segment',
      description: 'Star or unstar a segment. Requires segment:write scope.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Strava segment ID.' },
          starred: { type: 'boolean', description: 'true to star, false to unstar.' },
        },
        required: ['id', 'starred'],
      },
    },
    {
      name: 'list-starred-segments',
      description: "List the connected athlete's starred segments.",
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number' },
          per_page: { type: 'number' },
        },
      },
    },
  ];
}

export async function handleSegmentToolCall(request: any, client: StravaClient) {
  try {
    switch (request.params.name) {
      case 'get-segment': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return errText('id is required');
        const s = await client.getSegment(a.id);
        return { content: [{ type: 'text', text: formatSegmentDetailed(s) }] };
      }
      case 'explore-segments': {
        const a = (request.params.arguments ?? {}) as {
          bounds: number[]; activity_type?: 'running' | 'riding'; min_cat?: number; max_cat?: number;
        };
        if (!Array.isArray(a.bounds) || a.bounds.length !== 4) {
          return errText('bounds must be [SW lat, SW lng, NE lat, NE lng]');
        }
        const r = await client.exploreSegments({
          bounds: a.bounds as [number, number, number, number],
          activity_type: a.activity_type,
          min_cat: a.min_cat,
          max_cat: a.max_cat,
        });
        return { content: [{ type: 'text', text: formatExploredSegments(r) }] };
      }
      case 'star-segment': {
        const a = (request.params.arguments ?? {}) as { id: string; starred: boolean };
        if (!a.id || typeof a.starred !== 'boolean') return errText('id and starred are required');
        const s = await client.starSegment(a.id, a.starred);
        return { content: [{ type: 'text', text: `${a.starred ? 'Starred' : 'Unstarred'} segment ${a.id}.\n\n${formatSegmentDetailed(s)}` }] };
      }
      case 'list-starred-segments': {
        const a = (request.params.arguments ?? {}) as { page?: number; per_page?: number };
        const segs = await client.listStarredSegments({ page: a.page, per_page: a.per_page });
        return { content: [{ type: 'text', text: formatSegments(segs) }] };
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
