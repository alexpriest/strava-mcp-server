/**
 * Segment-effort tools.
 */
import { StravaClient } from '../strava/client.js';
import { handleToolError } from '../utils/errors.js';
import { formatSegmentEffort, formatSegmentEfforts } from '../utils/formatters.js';

export function getSegmentEffortTools() {
  return [
    {
      name: 'list-segment-efforts',
      description:
        "List the connected athlete's efforts on a given segment. Optionally filter by date range.",
      inputSchema: {
        type: 'object',
        properties: {
          segment_id: { type: 'string', description: 'Strava segment ID.' },
          start_date_local: { type: 'string', description: 'ISO 8601 start date (local).' },
          end_date_local: { type: 'string', description: 'ISO 8601 end date (local).' },
          per_page: { type: 'number' },
        },
        required: ['segment_id'],
      },
    },
    {
      name: 'get-segment-effort',
      description: 'Get a specific segment effort by effort ID.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Strava segment effort ID.' } },
        required: ['id'],
      },
    },
  ];
}

export async function handleSegmentEffortToolCall(request: any, client: StravaClient) {
  try {
    switch (request.params.name) {
      case 'list-segment-efforts': {
        const a = (request.params.arguments ?? {}) as {
          segment_id: string; start_date_local?: string; end_date_local?: string; per_page?: number;
        };
        if (!a.segment_id) return errText('segment_id is required');
        const efforts = await client.listSegmentEfforts({
          segment_id: a.segment_id,
          start_date_local: a.start_date_local,
          end_date_local: a.end_date_local,
          per_page: a.per_page,
        });
        return { content: [{ type: 'text', text: formatSegmentEfforts(efforts) }] };
      }
      case 'get-segment-effort': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return errText('id is required');
        const e = await client.getSegmentEffort(a.id);
        return { content: [{ type: 'text', text: formatSegmentEffort(e) }] };
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
