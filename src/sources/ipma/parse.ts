// PRECOG / Trend Radar · IPMA (Portugal's weather institute): reading fire-risk and warning replies.
import { at, list, num, obj, str } from '@sources/shape';

/** IPMA's fire-risk (RCM) reply: the risk level 1–5 of each municipality, and the day it is for. */
export function parseFireRisk(reply: unknown): { levels: number[]; day: string } {
  const j = obj(reply, 'IPMA fire risk');
  const levels = Object.values(obj(j.local, 'IPMA fire risk', 'local')).flatMap(x => {
    const v = num(at(x, 'data', 'rcm'));
    return v == null ? [] : [v];
  });
  return { levels, day: str(j.dataPrev) };
}
/** IPMA's weather warnings still running at `now`, other than green: their level and type. */
export function parseWarnings(reply: unknown, now = Date.now()): { level: string; type: string }[] {
  return list(reply, 'IPMA warnings').flatMap(w => {
    const level = str(at(w, 'awarenessLevelID')),
      end = Date.parse(str(at(w, 'endTime')));
    return level && level !== 'green' && end > now ? [{ level, type: str(at(w, 'awarenessTypeName')) }] : [];
  });
}
