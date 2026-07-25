/**
 * Gear tools.
 */
import { StravaClient } from '../strava/client.js';
import { handleToolError } from '../utils/errors.js';
import { formatGear } from '../utils/formatters.js';

export function getGearTools() {
  return [
    {
      name: 'get-gear',
      description:
        'Get gear (bike or shoes) details by gear ID. Gear IDs are returned by get-athlete (bikes/shoes) or appear on activities. Includes brand/model, mileage, primary/retired status.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Strava gear ID (e.g. "b1234567" for bikes, "g1234567" for shoes).' } },
        required: ['id'],
      },
    },
  ];
}

export async function handleGearToolCall(request: any, client: StravaClient) {
  try {
    switch (request.params.name) {
      case 'get-gear': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return { content: [{ type: 'text', text: 'Error: id is required' }], isError: true };
        const g = await client.getGear(a.id);
        return { content: [{ type: 'text', text: formatGear(g) }] };
      }
      default:
        return null;
    }
  } catch (error) {
    return { content: [{ type: 'text', text: handleToolError(error) }], isError: true };
  }
}
