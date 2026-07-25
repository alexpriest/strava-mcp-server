/**
 * Format helpers — turn raw Strava API responses into compact, readable text
 * for tool output. Strava distances are meters and durations are seconds.
 */
import {
  SummaryActivity,
  DetailedActivity,
  DetailedAthlete,
  ActivityStats,
  ActivityTotal,
  ActivityZone,
  Comment,
  Lap,
  Gear,
  Club,
  ClubActivity,
  ClubAthlete,
  Route,
  Segment,
  SummarySegment,
  ExplorerResponse,
  DetailedSegmentEffort,
  StreamSet,
  Upload,
  AthleteZones,
} from '../strava/types.js';

function metersToMiles(m: number): number {
  return m / 1609.344;
}

function metersToKm(m: number): number {
  return m / 1000;
}

function metersToFeet(m: number): number {
  return m * 3.28084;
}

function fmtDistance(m: number): string {
  const mi = metersToMiles(m);
  const km = metersToKm(m);
  return `${mi.toFixed(2)} mi (${km.toFixed(2)} km)`;
}

function fmtElevation(m: number): string {
  const ft = metersToFeet(m);
  return `${Math.round(ft)} ft (${Math.round(m)} m)`;
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtPace(metersPerSecond: number, sport: string): string {
  if (!metersPerSecond) return '—';
  // For runs/walks/hikes, format as min/mi. For rides, format as mph.
  const isRun = /run|walk|hike/i.test(sport);
  if (isRun) {
    const minPerMile = 1609.344 / metersPerSecond / 60;
    const mins = Math.floor(minPerMile);
    const secs = Math.round((minPerMile - mins) * 60);
    return `${mins}:${String(secs).padStart(2, '0')}/mi`;
  }
  const mph = (metersPerSecond * 2.23694);
  return `${mph.toFixed(1)} mph`;
}

export function formatActivitySummary(a: SummaryActivity): string {
  const date = a.start_date_local?.slice(0, 16).replace('T', ' ') ?? a.start_date;
  const parts = [
    `${a.name} (${a.sport_type})`,
    `  ID: ${a.id}`,
    `  Date: ${date}${a.timezone ? ` ${a.timezone}` : ''}`,
    `  Distance: ${fmtDistance(a.distance)}`,
    `  Moving time: ${fmtDuration(a.moving_time)}`,
    `  Elevation: ${fmtElevation(a.total_elevation_gain)}`,
  ];
  if (typeof a.average_speed === 'number') parts.push(`  Pace/Speed: ${fmtPace(a.average_speed, a.sport_type)}`);
  if (typeof a.average_heartrate === 'number') parts.push(`  Avg HR: ${Math.round(a.average_heartrate)} bpm${a.max_heartrate ? ` (max ${Math.round(a.max_heartrate)})` : ''}`);
  if (typeof a.average_watts === 'number') parts.push(`  Avg power: ${Math.round(a.average_watts)} W`);
  if (a.pr_count) parts.push(`  PRs: ${a.pr_count}`);
  return parts.join('\n');
}

export function formatActivityList(activities: SummaryActivity[]): string {
  if (activities.length === 0) return 'No activities found.';
  const header = `Found ${activities.length} activit${activities.length === 1 ? 'y' : 'ies'}:\n`;
  return header + activities.map(formatActivitySummary).join('\n\n');
}

export function formatActivityDetailed(a: DetailedActivity): string {
  const parts = [formatActivitySummary(a)];
  if (a.description) parts.push(`\nDescription: ${a.description}`);
  if (typeof a.calories === 'number') parts.push(`Calories: ${Math.round(a.calories)}`);
  if (a.gear?.name) parts.push(`Gear: ${a.gear.name}`);
  if (a.device_name) parts.push(`Device: ${a.device_name}`);

  if (a.splits_standard && a.splits_standard.length > 0) {
    parts.push('\nMile splits:');
    for (const s of a.splits_standard) {
      parts.push(`  ${s.split}. ${fmtDuration(s.moving_time)}` +
        (s.average_heartrate ? ` — ${Math.round(s.average_heartrate)} bpm` : '') +
        (typeof s.elevation_difference === 'number' ? ` — Δ ${Math.round(metersToFeet(s.elevation_difference))} ft` : ''));
    }
  } else if (a.splits_metric && a.splits_metric.length > 0) {
    parts.push('\nKM splits:');
    for (const s of a.splits_metric) {
      parts.push(`  ${s.split}. ${fmtDuration(s.moving_time)}` +
        (s.average_heartrate ? ` — ${Math.round(s.average_heartrate)} bpm` : ''));
    }
  }

  if (a.laps && a.laps.length > 0) {
    parts.push(`\nLaps (${a.laps.length}):`);
    for (const lap of a.laps) {
      parts.push(`  Lap ${lap.lap_index}${lap.name ? ` (${lap.name})` : ''}: ${fmtDistance(lap.distance)} — ${fmtDuration(lap.moving_time)}` +
        (lap.average_heartrate ? ` — ${Math.round(lap.average_heartrate)} bpm` : ''));
    }
  }

  return parts.join('\n');
}

export function formatAthlete(a: DetailedAthlete): string {
  const parts = [
    `${a.firstname ?? ''} ${a.lastname ?? ''}`.trim() || `Athlete ${a.id}`,
    `  ID: ${a.id}`,
  ];
  if (a.username) parts.push(`  Username: ${a.username}`);
  if (a.city || a.state || a.country) {
    parts.push(`  Location: ${[a.city, a.state, a.country].filter(Boolean).join(', ')}`);
  }
  if (a.sex) parts.push(`  Sex: ${a.sex}`);
  if (typeof a.weight === 'number') parts.push(`  Weight: ${a.weight} kg (${(a.weight * 2.20462).toFixed(1)} lb)`);
  if (typeof a.ftp === 'number') parts.push(`  FTP: ${a.ftp} W`);
  if (a.measurement_preference) parts.push(`  Measurement preference: ${a.measurement_preference}`);
  if (a.premium) parts.push(`  Premium: yes`);
  if (a.bikes && a.bikes.length > 0) {
    parts.push(`  Bikes: ${a.bikes.map(b => `${b.name ?? b.id}${typeof b.distance === 'number' ? ` (${metersToMiles(b.distance).toFixed(0)} mi)` : ''}`).join(', ')}`);
  }
  if (a.shoes && a.shoes.length > 0) {
    parts.push(`  Shoes: ${a.shoes.map(s => `${s.name ?? s.id}${typeof s.distance === 'number' ? ` (${metersToMiles(s.distance).toFixed(0)} mi)` : ''}`).join(', ')}`);
  }
  return parts.join('\n');
}

function fmtTotal(label: string, t?: ActivityTotal): string | null {
  if (!t || t.count === 0) return null;
  return `  ${label}: ${t.count} activit${t.count === 1 ? 'y' : 'ies'}, ${fmtDistance(t.distance)}, ${fmtDuration(t.moving_time)}, ${fmtElevation(t.elevation_gain)}`;
}

export function formatAthleteStats(s: ActivityStats): string {
  const parts: string[] = ['Athlete stats:'];
  const recent = ['Recent rides', 'Recent runs', 'Recent swims'];
  const recentTotals = [s.recent_ride_totals, s.recent_run_totals, s.recent_swim_totals];
  recent.forEach((label, i) => { const line = fmtTotal(label, recentTotals[i]); if (line) parts.push(line); });

  const ytd = ['YTD rides', 'YTD runs', 'YTD swims'];
  const ytdTotals = [s.ytd_ride_totals, s.ytd_run_totals, s.ytd_swim_totals];
  ytd.forEach((label, i) => { const line = fmtTotal(label, ytdTotals[i]); if (line) parts.push(line); });

  const all = ['All-time rides', 'All-time runs', 'All-time swims'];
  const allTotals = [s.all_ride_totals, s.all_run_totals, s.all_swim_totals];
  all.forEach((label, i) => { const line = fmtTotal(label, allTotals[i]); if (line) parts.push(line); });

  if (typeof s.biggest_ride_distance === 'number') {
    parts.push(`  Biggest ride: ${fmtDistance(s.biggest_ride_distance)}`);
  }
  if (typeof s.biggest_climb_elevation_gain === 'number') {
    parts.push(`  Biggest climb: ${fmtElevation(s.biggest_climb_elevation_gain)}`);
  }
  return parts.join('\n');
}

function fmtAthleteName(a?: { firstname?: string; lastname?: string }): string {
  if (!a) return 'Unknown';
  return `${a.firstname ?? ''} ${a.lastname ?? ''}`.trim() || 'Unknown';
}

export function formatComments(comments: Comment[]): string {
  if (!comments.length) return 'No comments.';
  return comments.map(c =>
    `${fmtAthleteName(c.athlete)} (${c.created_at}): ${c.text}`
  ).join('\n');
}

export function formatKudoers(athletes: Array<{ firstname?: string; lastname?: string }>): string {
  if (!athletes.length) return 'No kudos.';
  return `${athletes.length} kudo${athletes.length === 1 ? '' : 's'}:\n` +
    athletes.map(a => `  - ${fmtAthleteName(a)}`).join('\n');
}

export function formatLaps(laps: Lap[]): string {
  if (!laps.length) return 'No laps.';
  return `Laps (${laps.length}):\n` + laps.map(lap =>
    `  Lap ${lap.lap_index}${lap.name ? ` (${lap.name})` : ''}: ${fmtDistance(lap.distance)} — ${fmtDuration(lap.moving_time)}` +
    (lap.average_heartrate ? ` — ${Math.round(lap.average_heartrate)} bpm` : '') +
    (lap.average_watts ? ` — ${Math.round(lap.average_watts)} W` : '')
  ).join('\n');
}

export function formatGear(g: Gear): string {
  const parts = [
    `${g.name ?? g.nickname ?? g.id}`,
    `  ID: ${g.id}`,
  ];
  if (g.brand_name || g.model_name) parts.push(`  Brand/model: ${[g.brand_name, g.model_name].filter(Boolean).join(' ')}`);
  if (typeof g.distance === 'number') parts.push(`  Distance: ${fmtDistance(g.distance)}`);
  if (g.description) parts.push(`  Description: ${g.description}`);
  if (g.primary) parts.push(`  Primary: yes`);
  if (g.retired) parts.push(`  Retired: yes`);
  return parts.join('\n');
}

export function formatClub(c: Club): string {
  const parts = [
    `${c.name} (id ${c.id})`,
  ];
  if (c.sport_type) parts.push(`  Sport: ${c.sport_type}`);
  if (c.member_count) parts.push(`  Members: ${c.member_count}`);
  if (c.city || c.state || c.country) parts.push(`  Location: ${[c.city, c.state, c.country].filter(Boolean).join(', ')}`);
  if (c.private) parts.push(`  Private: yes`);
  if (c.url) parts.push(`  URL: ${c.url}`);
  if (c.description) parts.push(`  Description: ${c.description}`);
  return parts.join('\n');
}

export function formatClubList(clubs: Club[]): string {
  if (!clubs.length) return 'No clubs.';
  return clubs.map(formatClub).join('\n\n');
}

export function formatClubActivities(acts: ClubActivity[]): string {
  if (!acts.length) return 'No recent club activities.';
  return acts.map(a =>
    `${fmtAthleteName(a.athlete)} — ${a.name ?? '(unnamed)'} (${a.sport_type ?? a.type ?? '?'})` +
    (typeof a.distance === 'number' ? ` — ${fmtDistance(a.distance)}` : '') +
    (typeof a.moving_time === 'number' ? ` — ${fmtDuration(a.moving_time)}` : '')
  ).join('\n');
}

export function formatClubAthletes(athletes: ClubAthlete[]): string {
  if (!athletes.length) return 'No athletes.';
  return athletes.map(a =>
    `  - ${fmtAthleteName(a)}` +
    (a.admin ? ' [admin]' : '') +
    (a.owner ? ' [owner]' : '')
  ).join('\n');
}

function routeTypeLabel(t?: number): string {
  if (t === 1) return 'Ride';
  if (t === 2) return 'Run';
  return 'Route';
}

function routeSubTypeLabel(s?: number): string {
  switch (s) {
    case 1: return 'Road';
    case 2: return 'MTB';
    case 3: return 'CX';
    case 4: return 'Trail';
    case 5: return 'Mixed';
    default: return '';
  }
}

export function formatRoute(r: Route): string {
  const parts = [
    `${r.name ?? '(unnamed route)'} (id ${r.id_str ?? r.id})`,
    `  Type: ${routeTypeLabel(r.type)}${r.sub_type ? ` / ${routeSubTypeLabel(r.sub_type)}` : ''}`,
  ];
  if (typeof r.distance === 'number') parts.push(`  Distance: ${fmtDistance(r.distance)}`);
  if (typeof r.elevation_gain === 'number') parts.push(`  Elevation: ${fmtElevation(r.elevation_gain)}`);
  if (typeof r.estimated_moving_time === 'number') parts.push(`  Estimated time: ${fmtDuration(r.estimated_moving_time)}`);
  if (r.private) parts.push(`  Private: yes`);
  if (r.starred) parts.push(`  Starred: yes`);
  if (r.description) parts.push(`  Description: ${r.description}`);
  return parts.join('\n');
}

export function formatRoutes(routes: Route[]): string {
  if (!routes.length) return 'No routes.';
  return routes.map(formatRoute).join('\n\n');
}

export function formatSegmentSummary(s: SummarySegment): string {
  const parts = [`${s.name ?? '(unnamed segment)'} (id ${s.id})`];
  if (s.activity_type) parts.push(`  Activity: ${s.activity_type}`);
  if (typeof s.distance === 'number') parts.push(`  Distance: ${fmtDistance(s.distance)}`);
  if (typeof s.average_grade === 'number') parts.push(`  Avg grade: ${s.average_grade.toFixed(1)}%`);
  if (typeof s.maximum_grade === 'number') parts.push(`  Max grade: ${s.maximum_grade.toFixed(1)}%`);
  if (typeof s.climb_category === 'number') parts.push(`  Climb category: ${s.climb_category}`);
  if (s.city || s.state || s.country) parts.push(`  Location: ${[s.city, s.state, s.country].filter(Boolean).join(', ')}`);
  if (s.starred) parts.push(`  Starred: yes`);
  if (typeof s.pr_time === 'number') parts.push(`  PR time: ${fmtDuration(s.pr_time)}`);
  return parts.join('\n');
}

export function formatSegmentDetailed(s: Segment): string {
  const parts = [formatSegmentSummary(s)];
  if (typeof s.total_elevation_gain === 'number') parts.push(`  Total climb: ${fmtElevation(s.total_elevation_gain)}`);
  if (typeof s.effort_count === 'number') parts.push(`  Total efforts: ${s.effort_count}`);
  if (typeof s.athlete_count === 'number') parts.push(`  Athletes: ${s.athlete_count}`);
  if (typeof s.star_count === 'number') parts.push(`  Stars: ${s.star_count}`);
  if (s.athlete_segment_stats) {
    const a = s.athlete_segment_stats;
    if (typeof a.pr_elapsed_time === 'number') parts.push(`  Your PR: ${fmtDuration(a.pr_elapsed_time)}${a.pr_date ? ` (${a.pr_date})` : ''}`);
    if (typeof a.effort_count === 'number') parts.push(`  Your efforts: ${a.effort_count}`);
  }
  return parts.join('\n');
}

export function formatSegments(segments: SummarySegment[]): string {
  if (!segments.length) return 'No segments.';
  return segments.map(formatSegmentSummary).join('\n\n');
}

export function formatExploredSegments(r: ExplorerResponse): string {
  if (!r.segments?.length) return 'No segments found in those bounds.';
  return r.segments.map(s => {
    const parts = [`${s.name} (id ${s.id})`];
    if (typeof s.distance === 'number') parts.push(`  Distance: ${fmtDistance(s.distance)}`);
    if (typeof s.avg_grade === 'number') parts.push(`  Avg grade: ${s.avg_grade.toFixed(1)}%`);
    if (typeof s.elev_difference === 'number') parts.push(`  Elev diff: ${fmtElevation(s.elev_difference)}`);
    if (s.climb_category_desc) parts.push(`  Cat: ${s.climb_category_desc}`);
    return parts.join('\n');
  }).join('\n\n');
}

export function formatSegmentEffort(e: DetailedSegmentEffort): string {
  const parts = [
    `${e.name ?? 'Segment effort'} (effort id ${e.id})`,
  ];
  if (e.segment?.id) parts.push(`  Segment: ${e.segment.name ?? e.segment.id} (id ${e.segment.id})`);
  if (e.activity?.id) parts.push(`  Activity: ${e.activity.id}`);
  if (e.start_date_local) parts.push(`  Date: ${e.start_date_local}`);
  if (typeof e.distance === 'number') parts.push(`  Distance: ${fmtDistance(e.distance)}`);
  if (typeof e.elapsed_time === 'number') parts.push(`  Elapsed: ${fmtDuration(e.elapsed_time)}`);
  if (typeof e.moving_time === 'number') parts.push(`  Moving: ${fmtDuration(e.moving_time)}`);
  if (typeof e.average_heartrate === 'number') parts.push(`  Avg HR: ${Math.round(e.average_heartrate)} bpm`);
  if (typeof e.average_watts === 'number') parts.push(`  Avg W: ${Math.round(e.average_watts)}`);
  if (typeof e.average_cadence === 'number') parts.push(`  Avg cad: ${Math.round(e.average_cadence)}`);
  if (typeof e.pr_rank === 'number') parts.push(`  PR rank: ${e.pr_rank}`);
  if (typeof e.kom_rank === 'number') parts.push(`  KOM rank: ${e.kom_rank}`);
  return parts.join('\n');
}

export function formatSegmentEfforts(efforts: DetailedSegmentEffort[]): string {
  if (!efforts.length) return 'No efforts.';
  return `${efforts.length} effort${efforts.length === 1 ? '' : 's'}:\n\n` +
    efforts.map(formatSegmentEffort).join('\n\n');
}

export function formatStreamSet(streams: StreamSet): string {
  const keys = Object.keys(streams);
  if (!keys.length) return 'No streams.';
  // Returns a summary, not raw arrays — those would blow context budgets fast.
  const parts = ['Streams:'];
  for (const k of keys) {
    const s: any = streams[k];
    if (!s || typeof s !== 'object') continue;
    const data = (s.data ?? []) as any[];
    const size = Array.isArray(data) ? data.length : 0;
    let extra = '';
    if (size > 0 && typeof data[0] === 'number') {
      const nums = data as number[];
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      extra = ` — min ${min.toFixed(1)}, max ${max.toFixed(1)}, mean ${mean.toFixed(1)}`;
    }
    parts.push(`  ${k}: ${size} samples${s.resolution ? ` (${s.resolution})` : ''}${extra}`);
  }
  parts.push('\n(Raw stream arrays returned as JSON below if needed.)');
  parts.push('');
  parts.push(JSON.stringify(streams));
  return parts.join('\n');
}

export function formatUpload(u: Upload): string {
  const parts = [
    `Upload ${u.id_str ?? u.id ?? '(no id)'}`,
    `  Status: ${u.status ?? 'unknown'}`,
  ];
  if (u.error) parts.push(`  Error: ${u.error}`);
  if (u.activity_id) parts.push(`  Activity ID: ${u.activity_id}`);
  if (u.external_id) parts.push(`  External ID: ${u.external_id}`);
  return parts.join('\n');
}

export function formatAthleteZones(z: AthleteZones): string {
  const parts: string[] = [];
  if (z.heart_rate?.zones?.length) {
    parts.push('Heart rate zones:' + (z.heart_rate.custom_zones ? ' (custom)' : ''));
    z.heart_rate.zones.forEach((zone, i) => {
      const range = zone.max && zone.max > 0 ? `${zone.min}–${zone.max}` : `${zone.min}+`;
      parts.push(`  Zone ${i + 1}: ${range} bpm`);
    });
  }
  if (z.power?.zones?.length) {
    parts.push('Power zones:');
    z.power.zones.forEach((zone, i) => {
      const range = zone.max && zone.max > 0 ? `${zone.min}–${zone.max}` : `${zone.min}+`;
      parts.push(`  Zone ${i + 1}: ${range} W`);
    });
  }
  return parts.length ? parts.join('\n') : 'No zones configured.';
}

export function formatActivityZones(zones: ActivityZone[]): string {
  if (zones.length === 0) return 'No zone data available for this activity.';
  const parts: string[] = [];
  for (const z of zones) {
    parts.push(`Zone type: ${z.type ?? 'unknown'}${typeof z.score === 'number' ? ` (score: ${z.score})` : ''}`);
    if (z.distribution_buckets && z.distribution_buckets.length > 0) {
      const totalSec = z.distribution_buckets.reduce((sum, b) => sum + (b.time ?? 0), 0);
      z.distribution_buckets.forEach((b, i) => {
        const pct = totalSec > 0 ? ((b.time / totalSec) * 100).toFixed(1) : '0.0';
        const range = b.max ? `${b.min}–${b.max}` : `${b.min}+`;
        parts.push(`  Zone ${i + 1} (${range}): ${fmtDuration(b.time)} (${pct}%)`);
      });
    }
    parts.push('');
  }
  return parts.join('\n').trim();
}
