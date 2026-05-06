import { format } from 'date-fns'
import type { UserSettings, DayOfWeek, FixedBlock } from '@/types'
import { WORK_ACTIVITY_ID } from '@/types'
import { getCommuteMinutes, getLocationName, getLocationIcon } from './commute'

export interface ScheduledItem {
  kind: 'activity' | 'commute' | 'sleep' | 'buffer'
  id: string
  /** Stable identifier of the underlying activity (work / block.id / task.id).
   * Commute and buffer segments carry the id of the activity they precede so
   * UI can group them and per-day buffer overrides can target them. */
  activityId?: string
  title: string
  /** Start minute-of-day (0..1440, can be negative for previous-day bleed or >1440 for overnight). */
  startMin: number
  endMin: number
  locationId?: string
  /** For commute legs */
  fromLocationId?: string
  toLocationId?: string
}

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Resolve anchored start time for a fixed block. Returns null if the block
 * shouldn't appear on this day (e.g. work-anchored on a non-work day).
 */
function resolveBlockStart(
  block: FixedBlock,
  settings: UserSettings,
  isWorkDay: boolean
): number | null {
  const workStartMin = parseHHMM(settings.work.startTime)
  const workEndMin = parseHHMM(settings.work.endTime)
  const workLoc = settings.work.locationId

  switch (block.timingMode) {
    case 'before-work': {
      if (!isWorkDay) return null
      const commuteToWork = getCommuteMinutes(
        settings.commuteMatrix,
        block.locationId,
        workLoc
      )
      return workStartMin - commuteToWork - block.minutesPerDay
    }
    case 'after-work': {
      if (!isWorkDay) return null
      const commuteFromWork = getCommuteMinutes(
        settings.commuteMatrix,
        workLoc,
        block.locationId
      )
      return workEndMin + commuteFromWork
    }
    case 'morning':
      return parseHHMM(block.customStartTime ?? '07:30')
    case 'midday':
      return parseHHMM(block.customStartTime ?? '12:30')
    case 'evening':
      return parseHHMM(block.customStartTime ?? '18:30')
    case 'custom':
    default:
      return parseHHMM(block.customStartTime ?? '12:00')
  }
}

/** Does an activity run by default on this day-of-week? */
export function isScheduledByDefault(
  settings: UserSettings,
  activityId: string,
  dow: DayOfWeek
): boolean {
  if (activityId === 'sleep') return true
  if (activityId === WORK_ACTIVITY_ID) {
    return settings.work.daysOfWeek.includes(dow)
  }
  const block = settings.fixedBlocks.find((b) => b.id === activityId)
  if (block) {
    if (!block.enabled) return false
    return block.daysOfWeek ? block.daysOfWeek.includes(dow) : true
  }
  const task = settings.timeSensitiveTasks.find((t) => t.id === activityId)
  if (task) return task.daysOfWeek.includes(dow)
  return false
}

/** Is an activity active (scheduled) on a given date, honoring per-day overrides? */
export function isActivityActive(
  settings: UserSettings,
  activityId: string,
  date: Date
): boolean {
  const override = settings.dayOverrides?.[dateKey(date)]?.[activityId]
  if (override !== undefined) return override
  return isScheduledByDefault(settings, activityId, date.getDay() as DayOfWeek)
}

/**
 * Build an ordered schedule for a single day, dynamically inserting
 * directional commute legs between consecutive activities at different
 * locations, honoring per-day overrides.
 */
export function buildDaySchedule(
  settings: UserSettings,
  date: Date
): ScheduledItem[] {
  const dow = date.getDay() as DayOfWeek
  const key = dateKey(date)
  const overrides = settings.dayOverrides?.[key] ?? {}
  const timeOverridesForDay = settings.timeOverrides?.[key] ?? {}

  const active = (id: string, defaultActive: boolean): boolean =>
    overrides[id] ?? defaultActive

  /**
   * Apply a per-day time override (if any) to the supplied default times.
   * Returns the effective [startMin, endMin) for the activity on this date.
   */
  const applyTime = (
    id: string,
    defaultStart: number,
    defaultEnd: number
  ): { startMin: number; endMin: number } => {
    const ov = timeOverridesForDay[id]
    if (!ov) return { startMin: defaultStart, endMin: defaultEnd }
    const startMin = parseHHMM(ov.startTime)
    let endMin: number
    if (ov.endTime !== undefined) {
      endMin = parseHHMM(ov.endTime)
      // If end wraps past midnight (e.g. 23:00 → 01:00), adjust.
      if (endMin <= startMin) endMin += 1440
    } else if (ov.durationMinutes !== undefined) {
      endMin = startMin + ov.durationMinutes
    } else {
      endMin = startMin + (defaultEnd - defaultStart)
    }
    return { startMin, endMin }
  }

  const isWorkDay = active(
    WORK_ACTIVITY_ID,
    settings.work.daysOfWeek.includes(dow)
  )
  const activities: ScheduledItem[] = []

  // Sleep — one logical segment anchored to the night it begins. startMin is
  // the bedtime in minutes-of-day (0..1440); endMin may exceed 1440 when the
  // session crosses midnight. Commute/buffer chain walker and renderers will
  // split it as needed, but internally it's a single event so per-day
  // overrides and duration settings apply once.
  const bedMin = parseHHMM(settings.sleep.bedtime)
  const sleepDurationMin = Math.round((settings.sleep.hoursPerNight ?? 0) * 60)
  if (sleepDurationMin > 0 && active('sleep', true)) {
    const { startMin, endMin } = applyTime(
      'sleep',
      bedMin,
      bedMin + sleepDurationMin
    )
    activities.push({
      kind: 'sleep',
      id: 'sleep',
      activityId: 'sleep',
      title: '😴 Sleep',
      startMin,
      endMin,
      locationId: settings.homeLocationId,
    })
  }

  if (isWorkDay) {
    const { startMin, endMin } = applyTime(
      WORK_ACTIVITY_ID,
      parseHHMM(settings.work.startTime),
      parseHHMM(settings.work.endTime)
    )
    activities.push({
      kind: 'activity',
      id: WORK_ACTIVITY_ID,
      activityId: WORK_ACTIVITY_ID,
      title: `💼 ${settings.work.label}`,
      startMin,
      endMin,
      locationId: settings.work.locationId,
    })
  }

  for (const block of settings.fixedBlocks) {
    const defaultActive =
      block.enabled && (block.daysOfWeek ? block.daysOfWeek.includes(dow) : true)
    if (!active(block.id, defaultActive)) continue
    const defaultStart = resolveBlockStart(block, settings, isWorkDay)
    // If the block has no default start on this day (e.g. before-work on a
    // non-work day) but a time override is present, honor the override so the
    // user can add the block for a single day.
    const ov = timeOverridesForDay[block.id]
    if (defaultStart === null && !ov) continue
    const baseStart = defaultStart ?? 0
    const baseEnd = baseStart + block.minutesPerDay
    const { startMin, endMin } = applyTime(block.id, baseStart, baseEnd)
    activities.push({
      kind: 'activity',
      id: `block-${block.id}`,
      activityId: block.id,
      title: block.label,
      startMin,
      endMin,
      locationId: block.locationId,
    })
  }

  for (const task of settings.timeSensitiveTasks) {
    if (!active(task.id, task.daysOfWeek.includes(dow))) continue
    const defaultStart = parseHHMM(task.windowStart)
    const { startMin, endMin } = applyTime(
      task.id,
      defaultStart,
      defaultStart + task.durationMinutes
    )
    activities.push({
      kind: 'activity',
      id: `task-${task.id}`,
      activityId: task.id,
      title: task.name,
      startMin,
      endMin,
      locationId: task.locationId,
    })
  }

  activities.sort((a, b) => a.startMin - b.startMin)

  const out: ScheduledItem[] = []
  const homeId = settings.homeLocationId
  let currentLocation = homeId

  for (const act of activities) {
    if (act.locationId && act.locationId !== currentLocation) {
      const mins = getCommuteMinutes(
        settings.commuteMatrix,
        currentLocation,
        act.locationId
      )
      if (mins > 0) {
        const legStart = act.startMin - mins
        out.push({
          kind: 'commute',
          id: `commute-${currentLocation}-to-${act.locationId}-${act.id}`,
          activityId: act.activityId,
          title: `🚗 ${getLocationName(settings.locations, currentLocation)} → ${getLocationName(settings.locations, act.locationId)}`,
          startMin: legStart,
          endMin: act.startMin,
          fromLocationId: currentLocation,
          toLocationId: act.locationId,
        })
      }
      currentLocation = act.locationId
    }
    out.push(act)
  }

  if (
    settings.endDayAtHome &&
    currentLocation !== homeId &&
    activities.length > 0
  ) {
    const last = activities[activities.length - 1]!
    const mins = getCommuteMinutes(
      settings.commuteMatrix,
      currentLocation,
      homeId
    )
    if (mins > 0) {
      out.push({
        kind: 'commute',
        id: `commute-${currentLocation}-to-home-end`,
        title: `🚗 ${getLocationName(settings.locations, currentLocation)} → ${getLocationName(settings.locations, homeId)}`,
        startMin: last.endMin,
        endMin: last.endMin + mins,
        fromLocationId: currentLocation,
        toLocationId: homeId,
      })
    }
  }

  // Inject transition buffers — one before each activity that starts within
  // `bufferMinutes` of its predecessor. Buffers never ride on top of commute
  // legs (commute already serves as transition). Per-day overrides can shrink
  // a buffer to 0 (remove) or resize it.
  const bufferOverridesForDay = settings.bufferOverrides?.[key] ?? {}
  const defaultBuffer = settings.bufferMinutes ?? 0

  const withBuffers: ScheduledItem[] = []
  let prevEnd: number | null = null
  for (const item of out) {
    if ((item.kind === 'activity' || item.kind === 'sleep') && prevEnd !== null) {
      const gap = item.startMin - prevEnd
      const desired =
        bufferOverridesForDay[item.activityId ?? ''] ?? defaultBuffer
      if (desired > 0 && gap > 0) {
        const bufferLen = Math.min(desired, gap)
        withBuffers.push({
          kind: 'buffer',
          id: `buffer-${item.id}`,
          activityId: item.activityId,
          title: '⋯ Buffer',
          startMin: item.startMin - bufferLen,
          endMin: item.startMin,
        })
      }
    }
    withBuffers.push(item)
    prevEnd = item.endMin
  }

  return withBuffers
}

export function totalCommuteMinutesForDay(
  settings: UserSettings,
  date: Date
): number {
  return buildDaySchedule(settings, date)
    .filter((s) => s.kind === 'commute')
    .reduce((sum, s) => sum + (s.endMin - s.startMin), 0)
}

export function resolvedBufferMinutes(
  settings: UserSettings,
  date: Date,
  activityId: string
): number {
  const key = dateKey(date)
  return settings.bufferOverrides?.[key]?.[activityId] ?? settings.bufferMinutes ?? 0
}

/** Resolve the start/duration the UI should show for an activity on a given
 * date, after applying any per-day time override. */
export function resolvedActivityTime(
  settings: UserSettings,
  date: Date,
  activityId: string
): { startTime: string; durationMinutes: number } | null {
  const key = dateKey(date)
  const ov = settings.timeOverrides?.[key]?.[activityId]

  const defaults = getDefaultTime(settings, activityId, date.getDay() as DayOfWeek)
  if (!defaults && !ov) return null

  if (ov) {
    const startMin = parseHHMM(ov.startTime)
    let duration: number
    if (ov.endTime !== undefined) {
      let e = parseHHMM(ov.endTime)
      if (e <= startMin) e += 1440
      duration = e - startMin
    } else if (ov.durationMinutes !== undefined) {
      duration = ov.durationMinutes
    } else {
      duration = defaults?.durationMinutes ?? 60
    }
    return { startTime: ov.startTime, durationMinutes: duration }
  }
  return defaults
}

function getDefaultTime(
  settings: UserSettings,
  activityId: string,
  dow: DayOfWeek
): { startTime: string; durationMinutes: number } | null {
  if (activityId === 'sleep') {
    return {
      startTime: settings.sleep.bedtime,
      durationMinutes: Math.round(settings.sleep.hoursPerNight * 60),
    }
  }
  if (activityId === WORK_ACTIVITY_ID) {
    const s = parseHHMM(settings.work.startTime)
    const e = parseHHMM(settings.work.endTime)
    return { startTime: settings.work.startTime, durationMinutes: e - s }
  }
  const block = settings.fixedBlocks.find((b) => b.id === activityId)
  if (block) {
    const s = block.customStartTime ?? '12:00'
    return { startTime: s, durationMinutes: block.minutesPerDay }
  }
  const task = settings.timeSensitiveTasks.find((t) => t.id === activityId)
  if (task) {
    return { startTime: task.windowStart, durationMinutes: task.durationMinutes }
  }
  // Fallback for activities without a natural default on this dow
  void dow
  return null
}

export { getLocationName, getLocationIcon }
