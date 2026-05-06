import { addDays, startOfWeek, addWeeks, startOfDay } from 'date-fns'
import type { UserSettings, CalendarEvent, EventType, Recommendation } from '@/types'
import { buildDaySchedule, type ScheduledItem } from './daySchedule'

const MIN_IN_DAY = 1440

/** Minutes-of-day (0..1440) → absolute Date on `base`. Does NOT roll over. */
function minutesToDate(base: Date, minutes: number): Date {
  const d = startOfDay(base)
  return new Date(d.getTime() + minutes * 60_000)
}

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function kindToType(kind: ScheduledItem['kind']): EventType {
  if (kind === 'sleep') return 'sleep'
  if (kind === 'commute') return 'commute'
  if (kind === 'buffer') return 'buffer'
  return 'fixed'
}

/**
 * Push one or more CalendarEvents for a scheduled item, splitting at midnight
 * so each emitted event lies fully within its owning day. All segments of the
 * same logical item share a sessionId so click handlers / overrides can still
 * treat them as one.
 */
function pushSegments(
  events: CalendarEvent[],
  anchor: Date,
  item: ScheduledItem
) {
  const type = kindToType(item.kind)
  const iso = anchor.toISOString()
  const sessionId = `${item.id}-${iso}`
  const baseResource = {
    kind: item.kind,
    activityId: item.activityId,
    sessionId,
    anchorDateKey: iso.slice(0, 10),
  }

  let origStart = item.startMin
  const origEnd = item.endMin
  if (origEnd <= origStart) return

  let idx = 0
  while (origStart < origEnd) {
    // Which day (relative to anchor) does this chunk belong to?
    const day = Math.floor(origStart / MIN_IN_DAY)
    const dayStartAbs = day * MIN_IN_DAY
    const dayEndAbs = dayStartAbs + MIN_IN_DAY
    const chunkEnd = Math.min(origEnd, dayEndAbs)
    const localStart = origStart - dayStartAbs
    const localEnd = chunkEnd - dayStartAbs
    const segAnchor = addDays(anchor, day)
    const crossesMidnight = chunkEnd === dayEndAbs && origEnd > dayEndAbs

    // If the chunk ends exactly at midnight AND the logical event continues
    // into the next day, clamp the end to 23:59:59.999 of the current day.
    // Some calendars refuse to render events whose end === next day's start
    // in the current-day column because the range is [start, nextDayStart),
    // which many layout algorithms treat as "belongs to the next day."
    const startDate = minutesToDate(segAnchor, localStart)
    const endDate = crossesMidnight
      ? new Date(minutesToDate(segAnchor, localEnd).getTime() - 1)
      : minutesToDate(segAnchor, localEnd)

    events.push({
      id: `${sessionId}-seg${idx}`,
      title: item.title,
      start: startDate,
      end: endDate,
      type,
      resource: { ...baseResource, segmentIndex: idx },
    })

    origStart = chunkEnd
    idx += 1
  }
}

export function generateRecurringEvents(
  settings: UserSettings,
  weeksAhead: number = 8
): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const now = new Date()
  const start = startOfWeek(now, { weekStartsOn: 0 })

  for (let w = 0; w < weeksAhead; w++) {
    const weekStart = addWeeks(start, w)
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d)
      const schedule = buildDaySchedule(settings, date)
      for (const item of schedule) {
        pushSegments(events, date, item)
      }
    }
  }

  return events
}

/**
 * Convert pending/maybe Recommendation objects into CalendarEvent entries
 * so they appear in the calendar as interactive suggestion slots.
 */
export function recommendationsToEvents(recs: Recommendation[]): CalendarEvent[] {
  return recs
    .filter((r) => r.status === 'pending' || r.status === 'maybe')
    .map((r) => {
      const base = new Date(`${r.dateKey}T00:00:00`)
      return {
        id: r.id,
        title: `💡 ${r.title}`,
        start: new Date(base.getTime() + r.startMin * 60_000),
        end: new Date(base.getTime() + r.endMin * 60_000),
        type: 'recommendation' as const,
        resource: {
          recommendationId: r.id,
          category: r.category,
          priority: r.priority,
          status: r.status,
          isChunk: r.isChunk ?? false,
          fullDurationMinutes: r.fullDurationMinutes,
          endeavorEstimatedMinutes: r.endeavorEstimatedMinutes,
          endeavorId: r.endeavorId,
          endeavorColor: r.endeavorColor,
        },
      }
    })
}

// Kept for any call sites that still want to project sleep independently from
// the scheduler (currently none — sleep flows through buildDaySchedule).
export function sleepBoundsMinutes(settings: UserSettings): {
  startMin: number
  endMin: number
} {
  const startMin = parseHHMM(settings.sleep.bedtime)
  return { startMin, endMin: startMin + settings.sleep.hoursPerNight * 60 }
}
