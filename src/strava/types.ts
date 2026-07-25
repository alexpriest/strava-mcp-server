// Strava API types — only the fields we actually use are typed.
// The API returns lots more, which we pass through opaquely.

export interface StravaTokens {
  /** OAuth access token used as a Bearer for the Strava API. */
  access_token: string;
  /** OAuth refresh token — exchanged when the access token expires. */
  refresh_token: string;
  /** Unix epoch SECONDS at which the access token expires (Strava convention). */
  expires_at: number;
  /** Token type — always "Bearer" for Strava. */
  token_type?: string;
  /** Athlete object included on first exchange (not after refresh). */
  athlete?: SummaryAthlete;
  /** Scopes granted by the user. We don't get this back from /token, but we set it locally. */
  scope?: string;
}

export interface SummaryAthlete {
  id: number;
  firstname?: string;
  lastname?: string;
  username?: string;
  profile?: string;
  city?: string;
  state?: string;
  country?: string;
  sex?: string;
  premium?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DetailedAthlete extends SummaryAthlete {
  weight?: number;
  ftp?: number;
  measurement_preference?: string;
  date_preference?: string;
  bikes?: Array<{ id: string; name?: string; primary?: boolean; distance?: number }>;
  shoes?: Array<{ id: string; name?: string; primary?: boolean; distance?: number }>;
}

export interface SummaryActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  timezone?: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  average_speed?: number; // m/s
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  kilojoules?: number;
  has_heartrate?: boolean;
  device_watts?: boolean;
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  private?: boolean;
  visibility?: string;
  workout_type?: number;
  achievement_count?: number;
  pr_count?: number;
}

export interface DetailedActivity extends SummaryActivity {
  description?: string;
  calories?: number;
  segment_efforts?: any[];
  splits_metric?: Array<{
    distance: number;
    elapsed_time: number;
    elevation_difference: number;
    moving_time: number;
    split: number;
    average_speed?: number;
    average_heartrate?: number;
    pace_zone?: number;
  }>;
  splits_standard?: Array<{
    distance: number;
    elapsed_time: number;
    elevation_difference: number;
    moving_time: number;
    split: number;
    average_speed?: number;
    average_heartrate?: number;
    pace_zone?: number;
  }>;
  laps?: Array<{
    id: number;
    name?: string;
    elapsed_time: number;
    moving_time: number;
    distance: number;
    average_speed?: number;
    max_speed?: number;
    average_heartrate?: number;
    max_heartrate?: number;
    lap_index: number;
    split: number;
    start_index?: number;
    end_index?: number;
    total_elevation_gain?: number;
  }>;
  best_efforts?: any[];
  gear?: { id: string; name?: string };
  device_name?: string;
  embed_token?: string;
  available_zones?: string[];
}

export interface ActivityStats {
  biggest_ride_distance?: number;
  biggest_climb_elevation_gain?: number;
  recent_ride_totals?: ActivityTotal;
  recent_run_totals?: ActivityTotal;
  recent_swim_totals?: ActivityTotal;
  ytd_ride_totals?: ActivityTotal;
  ytd_run_totals?: ActivityTotal;
  ytd_swim_totals?: ActivityTotal;
  all_ride_totals?: ActivityTotal;
  all_run_totals?: ActivityTotal;
  all_swim_totals?: ActivityTotal;
}

export interface ActivityTotal {
  count: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  elevation_gain: number;
  achievement_count?: number;
}

export interface ActivityZone {
  score?: number;
  distribution_buckets?: Array<{ min: number; max: number; time: number }>;
  type?: 'heartrate' | 'power';
  resource_state?: number;
  sensor_based?: boolean;
  points?: number;
  custom_zones?: boolean;
  max?: number;
}

export interface Lap {
  id: number;
  name?: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  lap_index: number;
  split: number;
  start_index?: number;
  end_index?: number;
  total_elevation_gain?: number;
  start_date?: string;
  start_date_local?: string;
  pace_zone?: number;
  average_cadence?: number;
  average_watts?: number;
  device_watts?: boolean;
}

export interface Comment {
  id: number;
  activity_id: number;
  text: string;
  created_at: string;
  athlete?: SummaryAthlete;
}

export interface Gear {
  id: string;
  primary?: boolean;
  resource_state?: number;
  distance?: number;
  brand_name?: string;
  model_name?: string;
  frame_type?: number;
  description?: string;
  name?: string;
  nickname?: string;
  retired?: boolean;
  converted_distance?: number;
}

export interface Club {
  id: number;
  name: string;
  profile_medium?: string;
  cover_photo?: string;
  cover_photo_small?: string;
  sport_type?: string;
  activity_types?: string[];
  city?: string;
  state?: string;
  country?: string;
  private?: boolean;
  member_count?: number;
  featured?: boolean;
  verified?: boolean;
  url?: string;
  membership?: string;
  admin?: boolean;
  owner?: boolean;
  description?: string;
  club_type?: string;
}

export interface ClubActivity {
  athlete?: { firstname?: string; lastname?: string };
  name?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  type?: string;
  sport_type?: string;
  workout_type?: number | null;
}

export interface ClubAthlete {
  firstname?: string;
  lastname?: string;
  resource_state?: number;
  membership?: string;
  admin?: boolean;
  owner?: boolean;
}

export interface PolylineMap {
  id?: string;
  polyline?: string;
  summary_polyline?: string;
}

export interface Route {
  id: number | string;
  id_str?: string;
  name?: string;
  description?: string;
  athlete?: SummaryAthlete;
  distance?: number;
  elevation_gain?: number;
  map?: PolylineMap;
  type?: number; // 1 = ride, 2 = run
  sub_type?: number; // 1 road, 2 mtb, 3 cx, 4 trail, 5 mixed
  private?: boolean;
  starred?: boolean;
  timestamp?: number;
  estimated_moving_time?: number;
  segments?: SummarySegment[];
  created_at?: string;
  updated_at?: string;
}

export interface SummarySegment {
  id: number;
  name?: string;
  activity_type?: string;
  distance?: number;
  average_grade?: number;
  maximum_grade?: number;
  elevation_high?: number;
  elevation_low?: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  climb_category?: number;
  city?: string;
  state?: string;
  country?: string;
  private?: boolean;
  hazardous?: boolean;
  starred?: boolean;
  pr_time?: number;
  starred_date?: string;
}

export interface Segment extends SummarySegment {
  created_at?: string;
  updated_at?: string;
  total_elevation_gain?: number;
  map?: PolylineMap;
  effort_count?: number;
  athlete_count?: number;
  star_count?: number;
  athlete_segment_stats?: {
    pr_elapsed_time?: number;
    pr_date?: string;
    effort_count?: number;
  };
}

export interface ExplorerSegment {
  id: number;
  name: string;
  climb_category?: number;
  climb_category_desc?: string;
  avg_grade?: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  elev_difference?: number;
  distance?: number;
  points?: string;
}

export interface ExplorerResponse {
  segments: ExplorerSegment[];
}

export interface DetailedSegmentEffort {
  id: number;
  activity?: { id: number };
  athlete?: { id: number };
  name?: string;
  elapsed_time?: number;
  moving_time?: number;
  start_date?: string;
  start_date_local?: string;
  distance?: number;
  start_index?: number;
  end_index?: number;
  average_cadence?: number;
  average_watts?: number;
  device_watts?: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  segment?: SummarySegment;
  pr_rank?: number | null;
  achievements?: any[];
  hidden?: boolean;
  kom_rank?: number | null;
}

export interface Stream {
  type: string;
  data: number[] | number[][] | string[] | boolean[];
  series_type?: string;
  original_size?: number;
  resolution?: string;
}

export interface StreamSet {
  // When key_by_type=true: keyed by stream name (e.g. "heartrate", "watts").
  [key: string]: Stream | any;
}

export interface Upload {
  id?: number;
  id_str?: string;
  external_id?: string;
  error?: string | null;
  status?: string;
  activity_id?: number | null;
}

export interface AthleteZones {
  heart_rate?: { custom_zones?: boolean; zones?: Array<{ min: number; max: number }> };
  power?: { zones?: Array<{ min: number; max: number }> };
}
