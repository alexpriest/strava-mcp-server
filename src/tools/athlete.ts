/**
 * Athlete-related tools.
 */
import { StravaClient } from '../strava/client.js';
import { handleToolError } from '../utils/errors.js';
import { formatAthlete, formatAthleteStats, formatAthleteZones } from '../utils/formatters.js';

export function getAthleteTools() {
  return [
    {
      name: 'get-athlete',
      description: 'Get the connected Strava athlete profile (name, location, weight, FTP, gear).',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get-athlete-stats',
      description:
        "Get the connected athlete's totals — recent (last 4 weeks), year-to-date, and all-time totals for runs, rides, and swims (count, distance, time, elevation).",
      inputSchema: {
        type: 'object',
        properties: {
          athlete_id: { type: 'string', description: 'Optional Strava athlete ID. Defaults to the connected athlete.' },
        },
      },
    },
    {
      name: 'update-athlete-weight',
      description: 'Update the connected athlete weight in kilograms. Requires profile:write scope.',
      inputSchema: {
        type: 'object',
        properties: {
          weight: { type: 'number', description: 'Weight in kilograms (e.g. 72.5).' },
        },
        required: ['weight'],
      },
    },
    {
      name: 'get-athlete-zones',
      description: 'Get the connected athlete heart rate and power zones. Requires profile:read_all.',
      inputSchema: { type: 'object', properties: {} },
    },
  ];
}

export async function handleAthleteToolCall(request: any, client: StravaClient) {
  try {
    switch (request.params.name) {
      case 'get-athlete': {
        const athlete = await client.getAthlete();
        return { content: [{ type: 'text', text: formatAthlete(athlete) }] };
      }

      case 'get-athlete-stats': {
        const args = (request.params.arguments ?? {}) as { athlete_id?: string };
        let athleteId: string | number | undefined = args.athlete_id;
        if (!athleteId) {
          const me = await client.getAthlete();
          athleteId = me.id;
        }
        const stats = await client.getAthleteStats(athleteId);
        return { content: [{ type: 'text', text: formatAthleteStats(stats) }] };
      }

      case 'update-athlete-weight': {
        const a = (request.params.arguments ?? {}) as { weight: number };
        if (typeof a.weight !== 'number' || a.weight <= 0) {
          return { content: [{ type: 'text', text: 'Error: weight (kg, > 0) is required' }], isError: true };
        }
        const updated = await client.updateAthleteWeight(a.weight);
        return { content: [{ type: 'text', text: `Updated weight to ${a.weight} kg.\n\n${formatAthlete(updated)}` }] };
      }

      case 'get-athlete-zones': {
        const z = await client.getAthleteZones();
        return { content: [{ type: 'text', text: formatAthleteZones(z) }] };
      }

      default:
        return null;
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: handleToolError(error) }],
      isError: true,
    };
  }
}
