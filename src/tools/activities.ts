/**
 * Activity-related tools.
 */
import { StravaClient } from '../strava/client.js';
import { handleToolError } from '../utils/errors.js';
import {
  formatActivityList,
  formatActivityDetailed,
  formatActivityZones,
  formatComments,
  formatKudoers,
  formatLaps,
  formatStreamSet,
} from '../utils/formatters.js';

export function getActivityTools() {
  return [
    {
      name: 'get-recent-activities',
      description:
        'List recent Strava activities (default: last 30 days, up to 30 results). Returns activity summaries with distance, duration, pace, heart rate, and power. Use start_date / end_date to narrow the window, or page/per_page to paginate.',
      inputSchema: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'ISO 8601 date (YYYY-MM-DD) — only activities AFTER this date. Defaults to 30 days ago.' },
          end_date: { type: 'string', description: 'ISO 8601 date (YYYY-MM-DD) — only activities BEFORE this date.' },
          per_page: { type: 'number', description: 'Activities per page (default 30, max 100).', default: 30 },
          page: { type: 'number', description: 'Page number (1-indexed, default 1).', default: 1 },
        },
      },
    },
    {
      name: 'get-activity',
      description:
        'Get detailed info for a Strava activity by ID. Returns full activity details including splits (mile + km), laps, gear, device, calories, and description.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The Strava activity ID.' },
          include_all_efforts: {
            type: 'boolean',
            description: 'Include all segment efforts (defaults false). True is heavier but lists every segment ridden/run.',
            default: false,
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'create-manual-activity',
      description:
        'Create a manual activity entry on Strava (no GPS file — for treadmill/trainer/swims tracked by hand). Requires the activity:write scope.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Activity name.' },
          sport_type: { type: 'string', description: 'Strava sport type (Run, Ride, Swim, Walk, Hike, VirtualRide, etc.).' },
          start_date_local: { type: 'string', description: 'ISO 8601 datetime in athlete local time, e.g. 2024-01-15T08:30:00Z.' },
          elapsed_time: { type: 'number', description: 'Total elapsed time in seconds.' },
          distance: { type: 'number', description: 'Optional distance in meters.' },
          description: { type: 'string', description: 'Optional description.' },
          trainer: { type: 'boolean', description: 'Mark as trainer activity.' },
          commute: { type: 'boolean', description: 'Mark as commute.' },
        },
        required: ['name', 'sport_type', 'start_date_local', 'elapsed_time'],
      },
    },
    {
      name: 'update-activity',
      description:
        'Update an activity (name, description, sport type, gear, trainer/commute flags, hide-from-home). Requires activity:write (and activity:read_all for private activities).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The Strava activity ID.' },
          name: { type: 'string' },
          sport_type: { type: 'string', description: 'Strava sport type.' },
          description: { type: 'string' },
          trainer: { type: 'boolean' },
          commute: { type: 'boolean' },
          hide_from_home: { type: 'boolean', description: 'Hide from home feed.' },
          gear_id: { type: 'string', description: 'Gear ID. Use "none" to unset.' },
        },
        required: ['id'],
      },
    },
    {
      name: 'get-activity-comments',
      description: 'List comments on an activity.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The Strava activity ID.' },
          page: { type: 'number' },
          per_page: { type: 'number' },
        },
        required: ['id'],
      },
    },
    {
      name: 'get-activity-kudoers',
      description: 'List athletes who gave kudos on an activity.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The Strava activity ID.' },
          page: { type: 'number' },
          per_page: { type: 'number' },
        },
        required: ['id'],
      },
    },
    {
      name: 'get-activity-laps',
      description: 'List laps on an activity (auto laps from device, or manual lap presses).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The Strava activity ID.' },
        },
        required: ['id'],
      },
    },
    {
      name: 'get-activity-zones',
      description:
        'Get heart rate and/or power zone distribution for an activity. Time-in-zone breakdown. Many activities (no HR/power) return empty.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The Strava activity ID.' },
        },
        required: ['id'],
      },
    },
    {
      name: 'get-activity-streams',
      description:
        'Get raw time-series streams for an activity. Available keys (comma-separated): time, distance, latlng, altitude, velocity_smooth, heartrate, cadence, watts, temp, moving, grade_smooth. Response is keyed by stream type. Streams are large — request only the keys you need.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The Strava activity ID.' },
          keys: {
            type: 'string',
            description: 'Comma-separated keys (e.g. "heartrate,watts,velocity_smooth").',
          },
          resolution: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Sampling resolution. Defaults to high (per-second).',
          },
          series_type: {
            type: 'string',
            enum: ['time', 'distance'],
            description: 'Index series by time or distance.',
          },
        },
        required: ['id', 'keys'],
      },
    },
  ];
}

export async function handleActivityToolCall(request: any, client: StravaClient) {
  try {
    switch (request.params.name) {
      case 'get-recent-activities': {
        const args = (request.params.arguments ?? {}) as {
          start_date?: string;
          end_date?: string;
          per_page?: number;
          page?: number;
        };

        let after: number | undefined;
        let before: number | undefined;
        if (args.start_date) {
          const ts = Date.parse(args.start_date);
          if (!Number.isFinite(ts)) {
            return { content: [{ type: 'text', text: `Error: invalid start_date "${args.start_date}"` }], isError: true };
          }
          after = Math.floor(ts / 1000);
        } else {
          after = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
        }
        if (args.end_date) {
          const ts = Date.parse(args.end_date);
          if (!Number.isFinite(ts)) {
            return { content: [{ type: 'text', text: `Error: invalid end_date "${args.end_date}"` }], isError: true };
          }
          before = Math.floor(ts / 1000);
        }

        const activities = await client.getRecentActivities({
          after,
          before,
          page: args.page ?? 1,
          per_page: args.per_page ?? 30,
        });
        return { content: [{ type: 'text', text: formatActivityList(activities) }] };
      }

      case 'get-activity': {
        const { id, include_all_efforts } = (request.params.arguments ?? {}) as {
          id: string;
          include_all_efforts?: boolean;
        };
        if (!id) return errText('activity id is required');
        const activity = await client.getActivity(id, !!include_all_efforts);
        return { content: [{ type: 'text', text: formatActivityDetailed(activity) }] };
      }

      case 'create-manual-activity': {
        const a = (request.params.arguments ?? {}) as {
          name: string; sport_type: string; start_date_local: string; elapsed_time: number;
          distance?: number; description?: string; trainer?: boolean; commute?: boolean;
        };
        if (!a.name || !a.sport_type || !a.start_date_local || !a.elapsed_time) {
          return errText('name, sport_type, start_date_local, and elapsed_time are required');
        }
        const created = await client.createActivity({
          name: a.name,
          sport_type: a.sport_type,
          start_date_local: a.start_date_local,
          elapsed_time: a.elapsed_time,
          distance: a.distance,
          description: a.description,
          trainer: a.trainer ? 1 : undefined,
          commute: a.commute ? 1 : undefined,
        });
        return { content: [{ type: 'text', text: `Created activity ${created.id}.\n\n${formatActivityDetailed(created)}` }] };
      }

      case 'update-activity': {
        const a = (request.params.arguments ?? {}) as {
          id: string;
          name?: string; sport_type?: string; description?: string;
          trainer?: boolean; commute?: boolean; hide_from_home?: boolean; gear_id?: string;
        };
        if (!a.id) return errText('activity id is required');
        const { id, ...updates } = a;
        const updated = await client.updateActivity(id, updates);
        return { content: [{ type: 'text', text: `Updated activity ${id}.\n\n${formatActivityDetailed(updated)}` }] };
      }

      case 'get-activity-comments': {
        const a = (request.params.arguments ?? {}) as { id: string; page?: number; per_page?: number };
        if (!a.id) return errText('activity id is required');
        const comments = await client.getActivityComments(a.id, { page: a.page, per_page: a.per_page });
        return { content: [{ type: 'text', text: formatComments(comments) }] };
      }

      case 'get-activity-kudoers': {
        const a = (request.params.arguments ?? {}) as { id: string; page?: number; per_page?: number };
        if (!a.id) return errText('activity id is required');
        const kudoers = await client.getActivityKudoers(a.id, { page: a.page, per_page: a.per_page });
        return { content: [{ type: 'text', text: formatKudoers(kudoers) }] };
      }

      case 'get-activity-laps': {
        const a = (request.params.arguments ?? {}) as { id: string };
        if (!a.id) return errText('activity id is required');
        const laps = await client.getActivityLaps(a.id);
        return { content: [{ type: 'text', text: formatLaps(laps) }] };
      }

      case 'get-activity-zones': {
        const { id } = (request.params.arguments ?? {}) as { id: string };
        if (!id) return errText('activity id is required');
        const zones = await client.getActivityZones(id);
        return { content: [{ type: 'text', text: formatActivityZones(zones) }] };
      }

      case 'get-activity-streams': {
        const a = (request.params.arguments ?? {}) as {
          id: string; keys: string; resolution?: 'low' | 'medium' | 'high'; series_type?: 'time' | 'distance';
        };
        if (!a.id || !a.keys) return errText('id and keys are required');
        const streams = await client.getActivityStreams(a.id, {
          keys: a.keys,
          key_by_type: true,
          resolution: a.resolution,
          series_type: a.series_type,
        });
        return { content: [{ type: 'text', text: formatStreamSet(streams) }] };
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

function errText(msg: string) {
  return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
}
