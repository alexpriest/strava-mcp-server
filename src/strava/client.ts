/**
 * Thin Strava API v3 client. Each call obtains a fresh access token via
 * getValidAccessToken() (which auto-refreshes when needed).
 */
import { getValidAccessToken } from './oauth.js';
import { StravaAPIError } from '../utils/errors.js';
import {
  SummaryActivity,
  DetailedActivity,
  DetailedAthlete,
  ActivityStats,
  ActivityZone,
  Comment,
  Lap,
  Gear,
  Club,
  ClubActivity,
  ClubAthlete,
  Route,
  Segment,
  ExplorerResponse,
  SummarySegment,
  DetailedSegmentEffort,
  StreamSet,
  Upload,
  AthleteZones,
} from './types.js';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const REQUEST_TIMEOUT_MS = 60_000;

interface RequestOptions extends RequestInit {
  /** Return the raw response text (no JSON parse). For GPX/TCX endpoints. */
  expectText?: boolean;
  /** Override Accept header. */
  accept?: string;
  /** Don't stringify body — caller already prepared FormData / URLSearchParams. */
  rawBody?: boolean;
}

async function stravaRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const accessToken = await getValidAccessToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = endpoint.startsWith('http') ? endpoint : `${STRAVA_API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: options.accept ?? 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    };
    const { expectText, accept, rawBody, ...fetchOpts } = options;
    void rawBody;
    void accept;

    const resp = await fetch(url, {
      ...fetchOpts,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      let body = '';
      try { body = await resp.text(); } catch { /* ignore */ }
      let message = resp.statusText;
      try {
        const parsed = JSON.parse(body);
        message = parsed.message || parsed.error || JSON.stringify(parsed);
      } catch {
        if (body) message = body;
      }
      throw new StravaAPIError(message, resp.status);
    }

    if (expectText) {
      return (await resp.text()) as unknown as T;
    }

    // Some Strava endpoints return 204 No Content; guard against empty body.
    const text = await resp.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof StravaAPIError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new StravaAPIError('Strava API request timed out');
    }
    throw err;
  }
}

export interface RecentActivitiesParams {
  /** Unix epoch seconds — only activities AFTER this time. */
  after?: number;
  /** Unix epoch seconds — only activities BEFORE this time. */
  before?: number;
  page?: number;
  per_page?: number;
}

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface CreateActivityParams {
  name: string;
  /** Strava activity type (Run, Ride, Swim, etc.). */
  sport_type: string;
  /** ISO 8601 datetime in athlete's local time, e.g. 2024-01-15T08:30:00Z. */
  start_date_local: string;
  /** Seconds. */
  elapsed_time: number;
  /** Optional description. */
  description?: string;
  /** Distance in meters. */
  distance?: number;
  /** 1 = trainer, 0 = not. */
  trainer?: 0 | 1;
  /** 1 = commute, 0 = not. */
  commute?: 0 | 1;
}

export interface UpdateActivityParams {
  name?: string;
  sport_type?: string;
  description?: string;
  trainer?: boolean;
  commute?: boolean;
  hide_from_home?: boolean;
  gear_id?: string;
}

export interface ExploreSegmentsParams {
  /** [SW lat, SW lng, NE lat, NE lng]. */
  bounds: [number, number, number, number];
  activity_type?: 'running' | 'riding';
  /** Min climb category (0-5). Riding only. */
  min_cat?: number;
  /** Max climb category (0-5). Riding only. */
  max_cat?: number;
}

export interface ListSegmentEffortsParams {
  segment_id: number | string;
  /** ISO 8601 datetime. */
  start_date_local?: string;
  /** ISO 8601 datetime. */
  end_date_local?: string;
  per_page?: number;
}

export interface StreamsParams {
  /** Comma-separated key list. */
  keys: string;
  /** key_by_type — when true response is keyed by stream type. */
  key_by_type?: boolean;
  /** Sample resolution: low / medium / high. */
  resolution?: 'low' | 'medium' | 'high';
  /** time or distance index. */
  series_type?: 'time' | 'distance';
}

export interface UploadParams {
  /** Decoded file bytes. */
  fileBytes: Uint8Array;
  /** File name (used when constructing the multipart blob). */
  filename: string;
  /** fit | fit.gz | tcx | tcx.gz | gpx | gpx.gz. */
  data_type: string;
  name?: string;
  description?: string;
  trainer?: 0 | 1;
  commute?: 0 | 1;
  external_id?: string;
}

function buildPaginationQS(p: PaginationParams = {}): string {
  const qs = new URLSearchParams();
  if (typeof p.page === 'number') qs.append('page', String(p.page));
  if (typeof p.per_page === 'number') qs.append('per_page', String(Math.min(p.per_page, 200)));
  return qs.toString();
}

export class StravaClient {
  // --- Activities ---

  async getRecentActivities(params: RecentActivitiesParams = {}): Promise<SummaryActivity[]> {
    const { page = 1, per_page = 30, after, before } = params;
    const qs = new URLSearchParams({
      page: String(page),
      per_page: String(Math.min(per_page, 100)),
    });
    if (typeof after === 'number') qs.append('after', String(after));
    if (typeof before === 'number') qs.append('before', String(before));
    return stravaRequest<SummaryActivity[]>(`/athlete/activities?${qs.toString()}`);
  }

  async getActivity(id: string | number, includeAllEfforts = false): Promise<DetailedActivity> {
    const qs = new URLSearchParams({ include_all_efforts: String(includeAllEfforts) });
    return stravaRequest<DetailedActivity>(`/activities/${encodeURIComponent(String(id))}?${qs.toString()}`);
  }

  async createActivity(params: CreateActivityParams): Promise<DetailedActivity> {
    const body = new URLSearchParams();
    body.append('name', params.name);
    body.append('sport_type', params.sport_type);
    body.append('start_date_local', params.start_date_local);
    body.append('elapsed_time', String(params.elapsed_time));
    if (typeof params.distance === 'number') body.append('distance', String(params.distance));
    if (params.description) body.append('description', params.description);
    if (typeof params.trainer === 'number') body.append('trainer', String(params.trainer));
    if (typeof params.commute === 'number') body.append('commute', String(params.commute));
    return stravaRequest<DetailedActivity>('/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  async updateActivity(id: string | number, params: UpdateActivityParams): Promise<DetailedActivity> {
    return stravaRequest<DetailedActivity>(`/activities/${encodeURIComponent(String(id))}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }

  async getActivityComments(id: string | number, p: PaginationParams = {}): Promise<Comment[]> {
    const qs = buildPaginationQS(p);
    return stravaRequest<Comment[]>(`/activities/${encodeURIComponent(String(id))}/comments${qs ? `?${qs}` : ''}`);
  }

  async getActivityKudoers(id: string | number, p: PaginationParams = {}): Promise<ClubAthlete[]> {
    const qs = buildPaginationQS(p);
    return stravaRequest<ClubAthlete[]>(`/activities/${encodeURIComponent(String(id))}/kudos${qs ? `?${qs}` : ''}`);
  }

  async getActivityLaps(id: string | number): Promise<Lap[]> {
    return stravaRequest<Lap[]>(`/activities/${encodeURIComponent(String(id))}/laps`);
  }

  async getActivityZones(activityId: string | number): Promise<ActivityZone[]> {
    return stravaRequest<ActivityZone[]>(`/activities/${encodeURIComponent(String(activityId))}/zones`);
  }

  async getActivityStreams(id: string | number, p: StreamsParams): Promise<StreamSet> {
    const qs = new URLSearchParams({ keys: p.keys });
    if (p.key_by_type !== false) qs.append('key_by_type', 'true');
    if (p.resolution) qs.append('resolution', p.resolution);
    if (p.series_type) qs.append('series_type', p.series_type);
    return stravaRequest<StreamSet>(`/activities/${encodeURIComponent(String(id))}/streams?${qs.toString()}`);
  }

  // --- Athletes ---

  async getAthlete(): Promise<DetailedAthlete> {
    return stravaRequest<DetailedAthlete>('/athlete');
  }

  async updateAthleteWeight(weight: number): Promise<DetailedAthlete> {
    const body = new URLSearchParams({ weight: String(weight) });
    return stravaRequest<DetailedAthlete>('/athlete', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  async getAthleteZones(): Promise<AthleteZones> {
    return stravaRequest<AthleteZones>('/athlete/zones');
  }

  async getAthleteStats(athleteId: string | number): Promise<ActivityStats> {
    return stravaRequest<ActivityStats>(`/athletes/${encodeURIComponent(String(athleteId))}/stats`);
  }

  // --- Clubs ---

  async getClub(id: string | number): Promise<Club> {
    return stravaRequest<Club>(`/clubs/${encodeURIComponent(String(id))}`);
  }

  async getClubActivities(id: string | number, p: PaginationParams = {}): Promise<ClubActivity[]> {
    const qs = buildPaginationQS(p);
    return stravaRequest<ClubActivity[]>(`/clubs/${encodeURIComponent(String(id))}/activities${qs ? `?${qs}` : ''}`);
  }

  async getClubAdmins(id: string | number, p: PaginationParams = {}): Promise<ClubAthlete[]> {
    const qs = buildPaginationQS(p);
    return stravaRequest<ClubAthlete[]>(`/clubs/${encodeURIComponent(String(id))}/admins${qs ? `?${qs}` : ''}`);
  }

  async getClubMembers(id: string | number, p: PaginationParams = {}): Promise<ClubAthlete[]> {
    const qs = buildPaginationQS(p);
    return stravaRequest<ClubAthlete[]>(`/clubs/${encodeURIComponent(String(id))}/members${qs ? `?${qs}` : ''}`);
  }

  async listAthleteClubs(p: PaginationParams = {}): Promise<Club[]> {
    const qs = buildPaginationQS(p);
    return stravaRequest<Club[]>(`/athlete/clubs${qs ? `?${qs}` : ''}`);
  }

  // --- Gear ---

  async getGear(id: string): Promise<Gear> {
    return stravaRequest<Gear>(`/gear/${encodeURIComponent(id)}`);
  }

  // --- Routes ---

  async listAthleteRoutes(athleteId: string | number, p: PaginationParams = {}): Promise<Route[]> {
    const qs = buildPaginationQS(p);
    return stravaRequest<Route[]>(`/athletes/${encodeURIComponent(String(athleteId))}/routes${qs ? `?${qs}` : ''}`);
  }

  async getRoute(id: string | number): Promise<Route> {
    return stravaRequest<Route>(`/routes/${encodeURIComponent(String(id))}`);
  }

  async exportRouteGpx(id: string | number): Promise<string> {
    return stravaRequest<string>(`/routes/${encodeURIComponent(String(id))}/export_gpx`, {
      expectText: true,
      accept: 'application/gpx+xml',
    });
  }

  async exportRouteTcx(id: string | number): Promise<string> {
    return stravaRequest<string>(`/routes/${encodeURIComponent(String(id))}/export_tcx`, {
      expectText: true,
      accept: 'application/vnd.garmin.tcx+xml',
    });
  }

  async getRouteStreams(id: string | number): Promise<StreamSet> {
    return stravaRequest<StreamSet>(`/routes/${encodeURIComponent(String(id))}/streams`);
  }

  // --- Segments ---

  async getSegment(id: string | number): Promise<Segment> {
    return stravaRequest<Segment>(`/segments/${encodeURIComponent(String(id))}`);
  }

  async exploreSegments(params: ExploreSegmentsParams): Promise<ExplorerResponse> {
    const qs = new URLSearchParams({ bounds: params.bounds.join(',') });
    if (params.activity_type) qs.append('activity_type', params.activity_type);
    if (typeof params.min_cat === 'number') qs.append('min_cat', String(params.min_cat));
    if (typeof params.max_cat === 'number') qs.append('max_cat', String(params.max_cat));
    return stravaRequest<ExplorerResponse>(`/segments/explore?${qs.toString()}`);
  }

  async starSegment(id: string | number, starred: boolean): Promise<Segment> {
    const body = new URLSearchParams({ starred: String(starred) });
    return stravaRequest<Segment>(`/segments/${encodeURIComponent(String(id))}/starred`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }

  async listStarredSegments(p: PaginationParams = {}): Promise<SummarySegment[]> {
    const qs = buildPaginationQS(p);
    return stravaRequest<SummarySegment[]>(`/segments/starred${qs ? `?${qs}` : ''}`);
  }

  async getSegmentStreams(id: string | number): Promise<StreamSet> {
    return stravaRequest<StreamSet>(`/segments/${encodeURIComponent(String(id))}/streams`);
  }

  // --- Segment Efforts ---

  async listSegmentEfforts(p: ListSegmentEffortsParams): Promise<DetailedSegmentEffort[]> {
    const qs = new URLSearchParams({ segment_id: String(p.segment_id) });
    if (p.start_date_local) qs.append('start_date_local', p.start_date_local);
    if (p.end_date_local) qs.append('end_date_local', p.end_date_local);
    if (typeof p.per_page === 'number') qs.append('per_page', String(p.per_page));
    return stravaRequest<DetailedSegmentEffort[]>(`/segment_efforts?${qs.toString()}`);
  }

  async getSegmentEffort(id: string | number): Promise<DetailedSegmentEffort> {
    return stravaRequest<DetailedSegmentEffort>(`/segment_efforts/${encodeURIComponent(String(id))}`);
  }

  async getSegmentEffortStreams(id: string | number): Promise<StreamSet> {
    return stravaRequest<StreamSet>(`/segment_efforts/${encodeURIComponent(String(id))}/streams`);
  }

  // --- Uploads ---

  async uploadActivity(p: UploadParams): Promise<Upload> {
    const form = new FormData();
    const blob = new Blob([p.fileBytes as any]);
    form.append('file', blob, p.filename);
    form.append('data_type', p.data_type);
    if (p.name) form.append('name', p.name);
    if (p.description) form.append('description', p.description);
    if (typeof p.trainer === 'number') form.append('trainer', String(p.trainer));
    if (typeof p.commute === 'number') form.append('commute', String(p.commute));
    if (p.external_id) form.append('external_id', p.external_id);
    return stravaRequest<Upload>('/uploads', {
      method: 'POST',
      body: form as any,
    });
  }

  async getUploadStatus(id: string | number): Promise<Upload> {
    return stravaRequest<Upload>(`/uploads/${encodeURIComponent(String(id))}`);
  }
}
