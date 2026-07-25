/**
 * Club-related tools.
 */
import { StravaClient } from '../strava/client.js';
import { handleToolError } from '../utils/errors.js';
import {
  formatClub,
  formatClubList,
  formatClubActivities,
  formatClubAthletes,
} from '../utils/formatters.js';

export function getClubTools() {
  return [
    {
      name: 'get-club',
      description: 'Get a Strava club by ID (name, sport type, location, member count).',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Strava club ID.' } },
        required: ['id'],
      },
    },
    {
      name: 'get-club-activities',
      description: 'List recent activities posted in a club.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Strava club ID.' },
          page: { type: 'number' },
          per_page: { type: 'number' },
        },
        required: ['id'],
      },
    },
    {
      name: 'get-club-admins',
      description: 'List club admins.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Strava club ID.' },
          page: { type: 'number' },
          per_page: { type: 'number' },
        },
        required: ['id'],
      },
    },
    {
      name: 'get-club-members',
      description: 'List club members.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Strava club ID.' },
          page: { type: 'number' },
          per_page: { type: 'number' },
        },
        required: ['id'],
      },
    },
    {
      name: 'list-athlete-clubs',
      description: 'List clubs the connected athlete belongs to.',
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

export async function handleClubToolCall(request: any, client: StravaClient) {
  try {
    switch (request.params.name) {
      case 'get-club': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return errText('id is required');
        const c = await client.getClub(a.id);
        return { content: [{ type: 'text', text: formatClub(c) }] };
      }
      case 'get-club-activities': {
        const a = (request.params.arguments ?? {}) as { id: string; page?: number; per_page?: number };
        if (!a.id) return errText('id is required');
        const acts = await client.getClubActivities(a.id, { page: a.page, per_page: a.per_page });
        return { content: [{ type: 'text', text: formatClubActivities(acts) }] };
      }
      case 'get-club-admins': {
        const a = (request.params.arguments ?? {}) as { id: string; page?: number; per_page?: number };
        if (!a.id) return errText('id is required');
        const admins = await client.getClubAdmins(a.id, { page: a.page, per_page: a.per_page });
        return { content: [{ type: 'text', text: formatClubAthletes(admins) }] };
      }
      case 'get-club-members': {
        const a = (request.params.arguments ?? {}) as { id: string; page?: number; per_page?: number };
        if (!a.id) return errText('id is required');
        const members = await client.getClubMembers(a.id, { page: a.page, per_page: a.per_page });
        return { content: [{ type: 'text', text: formatClubAthletes(members) }] };
      }
      case 'list-athlete-clubs': {
        const a = (request.params.arguments ?? {}) as { page?: number; per_page?: number };
        const clubs = await client.listAthleteClubs({ page: a.page, per_page: a.per_page });
        return { content: [{ type: 'text', text: formatClubList(clubs) }] };
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
