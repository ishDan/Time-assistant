import { endOfYear, differenceInDays, startOfDay, addDays } from 'date-fns'
import type { UserSettings, FreeTimeSummary } from '@/types'
import { buildDaySchedule } from './daySchedule'

const MINUTES_IN_DAY = 24 * 60

export function calcDailyFreeMinutes(settings: UserSettings, date: Date): number {
  // Sleep is now emitted as a 'sleep' scheduled item, so we count it via the
  // schedule alongside everything else — no separate addition here.
  let occupied = settings.familyMinutesPerDay

  for (const item of buildDaySchedule(settings, date)) {
    occupied += item.endMin - item.startMin
  }

  return Math.max(0, MINUTES_IN_DAY - occupied)
}

export function calcWeeklyFreeMinutes(settings: UserSettings): number {
  const today = startOfDay(new Date())
  let total = 0
  for (let i = 0; i < 7; i++) {
    total += calcDailyFreeMinutes(settings, addDays(today, i))
  }
  return total
}

export function calcYearRemainingFreeHours(settings: UserSettings): number {
  const today = startOfDay(new Date())
  const yearEnd = endOfYear(today)
  const daysLeft = differenceInDays(yearEnd, today) + 1

  let totalMinutes = 0
  for (let i = 0; i < daysLeft; i++) {
    totalMinutes += calcDailyFreeMinutes(settings, addDays(today, i))
  }

  return Math.round(totalMinutes / 60)
}

export function buildFreeTimeSummary(settings: UserSettings): FreeTimeSummary {
  const today = startOfDay(new Date())
  const todayFreeMinutes = calcDailyFreeMinutes(settings, today)
  const weekFreeMinutes = calcWeeklyFreeMinutes(settings)
  const yearRemainingFreeHours = calcYearRemainingFreeHours(settings)

  return {
    todayFreeMinutes,
    weekFreeMinutes,
    yearRemainingFreeHours,
    sessionsUntilYearEnd: (sessionMinutes: number) =>
      Math.floor((yearRemainingFreeHours * 60) / sessionMinutes),
  }
}

export function formatFreeTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
