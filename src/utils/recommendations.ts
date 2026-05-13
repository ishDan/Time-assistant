import { addDays, startOfDay, format } from 'date-fns'
import type { UserSettings, Recommendation, Priority, Endeavor, CalendarEvent } from '@/types'
import { buildDaySchedule, dateKey } from './daySchedule'

type EndeavorProgress = Record<string, number>

/** Minimum gap (minutes) to surface any suggestion */
const MIN_GAP_MINUTES = 15

const PRIO_SCORE: Record<Priority, number> = { high: 3, medium: 2, low: 1 }

// ── Fallback generic templates (used when the user has no Planner endeavors) ──

interface SuggestionTemplate {
  title: string
  category: string
  minMinutes: number
  maxMinutes: number
  preferredTimes: ('morning' | 'afternoon' | 'evening')[]
  defaultPriority: Priority
  chunkable: boolean
}

const TEMPLATES: SuggestionTemplate[] = [
  { title: 'Go for a walk',          category: 'exercise',   minMinutes: 20, maxMinutes: 45,  preferredTimes: ['morning', 'evening'],              defaultPriority: 'medium', chunkable: false },
  { title: 'Stretch / yoga',         category: 'exercise',   minMinutes: 15, maxMinutes: 30,  preferredTimes: ['morning', 'evening'],              defaultPriority: 'low',    chunkable: false },
  { title: 'Exercise / Gym',         category: 'exercise',   minMinutes: 30, maxMinutes: 90,  preferredTimes: ['morning', 'afternoon', 'evening'], defaultPriority: 'high',   chunkable: true  },
  { title: 'Read a book',            category: 'learning',   minMinutes: 15, maxMinutes: 60,  preferredTimes: ['morning', 'evening'],              defaultPriority: 'medium', chunkable: true  },
  { title: 'Learn something new',    category: 'learning',   minMinutes: 20, maxMinutes: 90,  preferredTimes: ['morning', 'afternoon'],            defaultPriority: 'medium', chunkable: true  },
  { title: 'Study session',          category: 'learning',   minMinutes: 30, maxMinutes: 120, preferredTimes: ['morning', 'afternoon', 'evening'], defaultPriority: 'high',   chunkable: true  },
  { title: 'Work on a side project', category: 'creative',   minMinutes: 30, maxMinutes: 120, preferredTimes: ['morning', 'evening'],              defaultPriority: 'high',   chunkable: true  },
  { title: 'Deep work session',      category: 'creative',   minMinutes: 45, maxMinutes: 120, preferredTimes: ['morning'],                         defaultPriority: 'high',   chunkable: true  },
  { title: 'Creative project',       category: 'creative',   minMinutes: 20, maxMinutes: 90,  preferredTimes: ['morning', 'afternoon', 'evening'], defaultPriority: 'medium', chunkable: true  },
  { title: 'Meditate',               category: 'self-care',  minMinutes: 10, maxMinutes: 20,  preferredTimes: ['morning', 'evening'],              defaultPriority: 'medium', chunkable: false },
  { title: 'Journal',                category: 'self-care',  minMinutes: 10, maxMinutes: 20,  preferredTimes: ['morning', 'evening'],              defaultPriority: 'low',    chunkable: false },
  { title: 'Call a friend',          category: 'social',     minMinutes: 20, maxMinutes: 60,  preferredTimes: ['evening'],                         defaultPriority: 'medium', chunkable: false },
  { title: 'Run errands',            category: 'errands',    minMinutes: 30, maxMinutes: 90,  preferredTimes: ['afternoon'],                       defaultPriority: 'low',    chunkable: false },
  { title: 'Meal prep',              category: 'errands',    minMinutes: 20, maxMinutes: 60,  preferredTimes: ['afternoon', 'evening'],            defaultPriority: 'medium', chunkable: true  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function timeOfDay(startMin: number): 'morning' | 'afternoon' | 'evening' {
  if (startMin < 12 * 60) return 'morning'
  if (startMin < 18 * 60) return 'afternoon'
  return 'evening'
}

function customEventsOnDay(
  customEvents: CalendarEvent[],
  date: Date
): Array<{ start: number; end: number }> {
  const key = format(date, 'yyyy-MM-dd')
  const out: Array<{ start: number; end: number }> = []
  for (const e of customEvents) {
    const sKey = format(e.start, 'yyyy-MM-dd')
    const eKey = format(e.end, 'yyyy-MM-dd')
    if (sKey !== key && eKey !== key) continue
    const start = sKey === key ? e.start.getHours() * 60 + e.start.getMinutes() : 0
    const end = eKey === key ? e.end.getHours() * 60 + e.end.getMinutes() : 1440
    if (end > start) out.push({ start, end })
  }
  return out
}

function findFreeGaps(
  settings: UserSettings,
  date: Date,
  customEvents: CalendarEvent[] = [],
  nowMin?: number
): Array<{ startMin: number; endMin: number }> {
  const schedule = buildDaySchedule(settings, date)
  const scheduleRanges = schedule.map((s) => ({
    start: Math.max(0, s.startMin),
    end: Math.min(1440, s.endMin),
  }))
  // Manual events always win: treat user customEvents as occupied too so no
  // suggestion is ever placed on top of a real event.
  const occupied = [...scheduleRanges, ...customEventsOnDay(customEvents, date)]
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start)

  // Sleep is anchored to the night it begins, so sleepItem.endMin can exceed
  // 1440 (e.g. bedtime 23:00 + 8h = 1860). The wake time on the current day
  // is that value wrapped modulo 1440 — using the raw end would put wake at
  // midnight and produce zero gaps.
  const sleepItem = schedule.find((s) => s.kind === 'sleep')
  const rawWake = sleepItem ? sleepItem.endMin % 1440 : 6 * 60
  const bedtimeMin = parseHHMM(settings.sleep.bedtime)

  // Guard: if the wake minute somehow ends up at or past bedtime (edge case
  // with unusual sleep settings) fall back to 6 AM so empty days still produce
  // a usable free window.
  const wakeMin = rawWake < bedtimeMin ? rawWake : 6 * 60

  // For today, never suggest slots that have already passed. Advance the
  // cursor to the current time so only future gaps are returned.
  const gaps: Array<{ startMin: number; endMin: number }> = []
  let cursor = nowMin !== undefined ? Math.max(wakeMin, nowMin) : wakeMin

  for (const r of occupied) {
    // Skip ranges that fall entirely before wake time or after bedtime.
    if (r.end <= wakeMin || r.start >= bedtimeMin) continue
    if (r.start > cursor) {
      const gapEnd = Math.min(r.start, bedtimeMin)
      if (gapEnd - cursor >= MIN_GAP_MINUTES) {
        gaps.push({ startMin: cursor, endMin: gapEnd })
      }
    }
    cursor = Math.max(cursor, r.end)
  }

  if (cursor < bedtimeMin && bedtimeMin - cursor >= MIN_GAP_MINUTES) {
    gaps.push({ startMin: cursor, endMin: bedtimeMin })
  }

  return gaps
}

/** LCG seeded PRNG — deterministic per week so suggestions are stable on refresh */
function makePrng(seed: number) {
  let s = seed
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0
    return (s >>> 0) / 0x100000000
  }
}

// ── Endeavor-based suggestion ─────────────────────────────────────────────────

function endeavorMatchesTime(
  e: Endeavor,
  tod: 'morning' | 'afternoon' | 'evening'
): boolean {
  return e.preferredTimeOfDay === 'any' || e.preferredTimeOfDay === tod
}

function buildEndeavorRec(
  endeavor: Endeavor,
  key: string,
  gapStart: number,
  gapDuration: number,
  remainingMin: number
): Omit<Recommendation, 'id'> {
  const duration = Math.min(remainingMin, gapDuration)

  return {
    dateKey: key,
    startMin: gapStart,
    endMin: gapStart + duration,
    title: `${duration}m on: ${endeavor.name}`,
    category: 'endeavor',
    priority: endeavor.priority ?? 'medium',
    status: 'pending',
    generatedAt: new Date().toISOString(),
    isChunk: true,
    fullDurationMinutes: remainingMin,
    endeavorEstimatedMinutes: endeavor.estimatedMinutes,
    endeavorId: endeavor.id,
    endeavorColor: endeavor.color,
    locationId: endeavor.locationId,
  }
}

// ── Template-based fallback ───────────────────────────────────────────────────

function pickTemplate(
  gapDuration: number,
  tod: 'morning' | 'afternoon' | 'evening',
  rand: () => number
): { tpl: SuggestionTemplate; duration: number; isChunk: boolean } | null {
  type Scored = { tpl: SuggestionTemplate; duration: number; isChunk: boolean; score: number }
  const scored: Scored[] = []

  for (const tpl of TEMPLATES) {
    if (!tpl.preferredTimes.includes(tod)) continue
    const base = PRIO_SCORE[tpl.defaultPriority]
    const jitter = (rand() - 0.5) * 0.6

    if (tpl.minMinutes <= gapDuration) {
      if (tpl.maxMinutes <= gapDuration) {
        const duration = Math.min(tpl.maxMinutes, Math.floor(gapDuration * 0.75))
        scored.push({ tpl, duration, isChunk: false, score: base + 0.5 + jitter })
      } else if (tpl.chunkable) {
        scored.push({ tpl, duration: gapDuration, isChunk: true, score: base + jitter })
      } else {
        scored.push({ tpl, duration: tpl.minMinutes, isChunk: false, score: base - 0.2 + jitter })
      }
    } else if (tpl.chunkable && gapDuration >= MIN_GAP_MINUTES) {
      scored.push({ tpl, duration: gapDuration, isChunk: true, score: base - 0.4 + jitter })
    }
  }

  if (scored.length === 0) return null
  scored.sort((a, b) => b.score - a.score)
  const { score: _s, ...best } = scored[0]!
  return best
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate suggestions for one week.
 *
 * Priority order per gap:
 *   1. Planner endeavors that match the time-of-day preference (highest priority first)
 *   2. Generic templates (fallback when no endeavors exist or match)
 *
 * Chunking applies when the gap is shorter than the endeavor's session length.
 */
export function generateWeeklyRecommendations(
  settings: UserSettings,
  endeavors: Endeavor[],
  weekStart: Date,
  existing: Recommendation[],
  customEvents: CalendarEvent[] = [],
  endeavorProgress: EndeavorProgress = {}
): Recommendation[] {
  const existingIds = new Set(existing.map((r) => r.id))
  const result: Recommendation[] = []
  const rand = makePrng(startOfDay(weekStart).getTime())

  // Rotate through endeavors across the week so each one gets airtime
  let endeavorIdx = 0

  const todayKey = dateKey(startOfDay(new Date()))

  for (let d = 0; d < 7; d++) {
    const date = addDays(weekStart, d)
    const key = dateKey(date)

    // Never suggest on past days — only today and future are actionable.
    if (key < todayKey) continue

    // For today, pass the current minute so gaps that have already passed
    // are excluded (e.g. no suggestions at 11 PM for earlier in the day).
    const nowMin =
      key === todayKey
        ? new Date().getHours() * 60 + new Date().getMinutes()
        : undefined

    const gaps = findFreeGaps(settings, date, customEvents, nowMin)

    // Empty/non-work days can have one very large gap — surface up to 3
    // suggestions so open days get as much coverage as busy days.
    for (const gap of gaps.slice(0, 3)) {
      const id = `rec-${key}-${gap.startMin}`
      if (existingIds.has(id)) continue

      const gapDuration = gap.endMin - gap.startMin
      const tod = timeOfDay(gap.startMin)

      // ── Try Planner endeavors first ────────────────────────────────────────
      if (endeavors.length > 0) {
        // Exclude endeavors that have completed a full cycle — no more suggestions
        // until the user manually resets progress via resetEndeavorProgress.
        const activeEndeavors = endeavors.filter((e) => {
          const completed = endeavorProgress[e.id] ?? 0
          return completed === 0 || completed % e.estimatedMinutes !== 0
        })

        const pool2 = activeEndeavors.length > 0 ? activeEndeavors : null
        if (!pool2) {
          // All endeavors completed — fall through to generic template
        } else {
          // Filter by time-of-day preference
          const matching = pool2.filter((e) => endeavorMatchesTime(e, tod))
          const pool = matching.length > 0 ? matching : pool2

          // Sort pool: highest priority first, then seeded-random jitter for variety
          const sorted = [...pool].sort(
            (a, b) =>
              PRIO_SCORE[b.priority ?? 'medium'] -
              PRIO_SCORE[a.priority ?? 'medium'] +
              (rand() - 0.5) * 0.6
          )

          // Round-robin through endeavors so different goals get weekly coverage
          const endeavor = sorted[endeavorIdx % sorted.length]!
          endeavorIdx++

          const completed = endeavorProgress[endeavor.id] ?? 0
          const remainingMin = endeavor.estimatedMinutes - (completed % endeavor.estimatedMinutes)

          result.push({
            id,
            ...buildEndeavorRec(endeavor, key, gap.startMin, gapDuration, remainingMin),
          })
          continue
        }
      }

      // ── Fallback: generic template ─────────────────────────────────────────
      const pick = pickTemplate(gapDuration, tod, rand)
      if (!pick) continue

      const { tpl, duration, isChunk } = pick
      result.push({
        id,
        dateKey: key,
        startMin: gap.startMin,
        endMin: gap.startMin + duration,
        title: isChunk ? `${duration}m session: ${tpl.title}` : tpl.title,
        category: tpl.category,
        priority: tpl.defaultPriority,
        status: 'pending',
        generatedAt: new Date().toISOString(),
        isChunk,
        fullDurationMinutes: isChunk ? tpl.maxMinutes : undefined,
      })
    }
  }

  return result
}

// ── Productivity stats ────────────────────────────────────────────────────────

export function calcCurrentStreak(log: Record<string, number>): number {
  let streak = 0
  const today = startOfDay(new Date())
  for (let i = 0; i < 365; i++) {
    const k = dateKey(addDays(today, -i))
    if (log[k] !== undefined) streak++
    else break
  }
  return streak
}

export function calcLongestStreak(log: Record<string, number>): number {
  const keys = Object.keys(log).sort()
  if (keys.length === 0) return 0
  let longest = 1
  let current = 1
  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1]!)
    const curr = new Date(keys[i]!)
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000)
    if (diffDays === 1) {
      current++
      if (current > longest) longest = current
    } else {
      current = 1
    }
  }
  return longest
}

export function calcTotalProductiveHours(log: Record<string, number>): number {
  return Math.round(Object.values(log).reduce((s, m) => s + m, 0) / 60)
}

export function calcWeeklyProductiveMinutes(
  log: Record<string, number>,
  weekStart: Date
): number {
  let total = 0
  for (let d = 0; d < 7; d++) total += log[dateKey(addDays(weekStart, d))] ?? 0
  return total
}

export function calcMonthlyProductiveMinutes(
  log: Record<string, number>,
  year: number,
  month: number
): number {
  let total = 0
  for (const [key, mins] of Object.entries(log)) {
    const [y, m] = key.split('-').map(Number)
    if (y === year && m === month) total += mins
  }
  return total
}
