import type { UserSettings, CalendarEvent } from '@/types'
import { buildDaySchedule, dateKey } from './daySchedule'

const MIN_DURATION = 15

export interface Range {
  startMin: number
  endMin: number
}

export interface SnapResult {
  startMin: number
  endMin: number
  /** True when the requested range overlapped an occupied block and had to move. */
  snapped: boolean
  /** Set when no free window of any length exists on the day. */
  noFreeSlot?: boolean
}

function dayMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** Collect occupied minute ranges for the given date, clipped to [0, 1440).
 *  Covers the fixed schedule (sleep, work, blocks, tasks, commute, buffers)
 *  plus any user-added custom events that fall on this date. */
function collectOccupied(
  settings: UserSettings,
  customEvents: CalendarEvent[],
  date: Date
): Range[] {
  const schedule = buildDaySchedule(settings, date)
  const ranges: Range[] = schedule
    .map((s) => ({
      startMin: Math.max(0, s.startMin),
      endMin: Math.min(1440, s.endMin),
    }))
    .filter((r) => r.endMin > r.startMin)

  const key = dateKey(date)
  for (const e of customEvents) {
    const startKey = dateKey(e.start)
    const endKey = dateKey(e.end)
    if (startKey !== key && endKey !== key) continue
    const startMin = startKey === key ? dayMinutes(e.start) : 0
    const endMin = endKey === key ? dayMinutes(e.end) : 1440
    if (endMin > startMin) ranges.push({ startMin, endMin })
  }

  return mergeRanges(ranges)
}

function mergeRanges(input: Range[]): Range[] {
  if (input.length === 0) return []
  const sorted = [...input].sort((a, b) => a.startMin - b.startMin)
  const out: Range[] = [sorted[0]!]
  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i]!
    const last = out[out.length - 1]!
    if (curr.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, curr.endMin)
    } else {
      out.push({ ...curr })
    }
  }
  return out
}

function freeWindowsFrom(occupied: Range[]): Range[] {
  const wins: Range[] = []
  let cursor = 0
  for (const r of occupied) {
    if (r.startMin > cursor) wins.push({ startMin: cursor, endMin: r.startMin })
    cursor = Math.max(cursor, r.endMin)
  }
  if (cursor < 1440) wins.push({ startMin: cursor, endMin: 1440 })
  return wins
}

/**
 * Snap a requested range to the nearest free window on `date`, respecting
 * buffers around fixed activities. Rules:
 *   - If the requested range fits inside a free window, use it as-is.
 *   - Otherwise, try to place a block of the original duration at the start
 *     of the nearest free window (by absolute distance to the requested start).
 *   - If no window is long enough, shrink to the largest available window
 *     (minimum 15m) near the requested time.
 *   - If no free minutes exist at all, return the raw request and flag it.
 */
export function snapToFreeSlot(
  settings: UserSettings,
  customEvents: CalendarEvent[],
  date: Date,
  requestedStart: Date,
  requestedEnd: Date
): SnapResult {
  const buffer = settings.bufferMinutes ?? 0
  const reqStart = dayMinutes(requestedStart)
  const reqEnd = Math.max(reqStart + MIN_DURATION, dayMinutes(requestedEnd))
  const desiredDuration = reqEnd - reqStart

  const occupied = collectOccupied(settings, customEvents, date)
  // Pad occupied ranges by buffer so new events don't crowd existing ones.
  const padded = mergeRanges(
    occupied.map((r) => ({
      startMin: Math.max(0, r.startMin - buffer),
      endMin: Math.min(1440, r.endMin + buffer),
    }))
  )

  const windows = freeWindowsFrom(padded).filter(
    (w) => w.endMin - w.startMin >= MIN_DURATION
  )

  if (windows.length === 0) {
    return { startMin: reqStart, endMin: reqEnd, snapped: false, noFreeSlot: true }
  }

  // Does the requested range fit entirely in any free window?
  const fits = windows.find(
    (w) => reqStart >= w.startMin && reqEnd <= w.endMin
  )
  if (fits) {
    return { startMin: reqStart, endMin: reqEnd, snapped: false }
  }

  // Pick the window closest to the requested start.
  const scored = windows
    .map((w) => {
      const clampedStart = Math.max(w.startMin, Math.min(reqStart, w.endMin - MIN_DURATION))
      const distance = Math.abs(clampedStart - reqStart)
      const length = w.endMin - w.startMin
      return { w, clampedStart, distance, length }
    })
    .sort((a, b) => {
      // Prefer windows that can hold the full duration; then by closeness.
      const aFits = a.length >= desiredDuration ? 0 : 1
      const bFits = b.length >= desiredDuration ? 0 : 1
      if (aFits !== bFits) return aFits - bFits
      return a.distance - b.distance
    })

  const best = scored[0]!
  const duration = Math.min(desiredDuration, best.length)
  const startMin = Math.max(
    best.w.startMin,
    Math.min(best.clampedStart, best.w.endMin - duration)
  )
  return {
    startMin,
    endMin: startMin + duration,
    snapped: true,
  }
}

export function minutesToDate(base: Date, minutes: number): Date {
  const d = new Date(base)
  d.setHours(0, 0, 0, 0)
  return new Date(d.getTime() + minutes * 60_000)
}

export function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
