import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  UserSettings,
  CalendarEvent,
  Endeavor,
  FixedBlock,
  ActivityPreset,
  Location,
  CommuteMatrix,
  DayOfWeek,
  Recommendation,
  ProductivityLog,
} from '@/types'
import { ACTIVITY_PRESETS } from '@/types'
import { generateWeeklyRecommendations } from '@/utils/recommendations'
import { buildDaySchedule } from '@/utils/daySchedule'
import { startOfWeek, addWeeks, format } from 'date-fns'

/** Per-day override state captured before an edit for rollback. */
export interface DayOverrideSet {
  dateKey: string
  dayOverrides: Record<string, boolean>
  bufferOverrides: Record<string, number>
  timeOverrides: Record<string, { startTime: string; durationMinutes?: number; endTime?: string }>
}

/** Snapshot covering one or more days (cross-day drag needs both source and
 *  destination captured so rollback is complete). */
export interface DaySnapshot {
  days: DayOverrideSet[]
}
import { setCommuteMinutes, removeLocationFromMatrix, canonicalKey } from '@/utils/commute'

const HOME_ID = 'home'
const WORK_ID = 'work'

const DEFAULT_LOCATIONS: Location[] = [
  { id: HOME_ID, name: 'Home', icon: '🏠' },
  { id: WORK_ID, name: 'Work', icon: '💼' },
  { id: 'gym', name: 'Gym', icon: '💪' },
]

const DEFAULT_MATRIX: CommuteMatrix = {
  [canonicalKey(HOME_ID, WORK_ID)]: 30,
  [canonicalKey(HOME_ID, 'gym')]: 15,
  [canonicalKey(WORK_ID, 'gym')]: 15,
}

const EVERY_DAY: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS: DayOfWeek[] = [1, 2, 3, 4, 5]
const MWF: DayOfWeek[] = [1, 3, 5]

const DEFAULT_FIXED_BLOCKS: FixedBlock[] = [
  { id: 'breakfast', label: '🍳 Breakfast', icon: '🍳', enabled: true, minutesPerDay: 20, timingMode: 'morning', customStartTime: '07:30', activityPreset: 'breakfast', locationId: HOME_ID, daysOfWeek: EVERY_DAY },
  { id: 'lunch', label: '🥗 Lunch', icon: '🥗', enabled: true, minutesPerDay: 30, timingMode: 'midday', customStartTime: '12:30', activityPreset: 'lunch', locationId: WORK_ID, daysOfWeek: WEEKDAYS },
  { id: 'dinner', label: '🍽️ Dinner', icon: '🍽️', enabled: true, minutesPerDay: 45, timingMode: 'evening', customStartTime: '18:30', activityPreset: 'dinner', locationId: HOME_ID, daysOfWeek: EVERY_DAY },
  { id: 'personal-care', label: '🚿 Personal Care', icon: '🚿', enabled: true, minutesPerDay: 30, timingMode: 'morning', customStartTime: '07:00', activityPreset: 'personal-care', locationId: HOME_ID, daysOfWeek: EVERY_DAY },
  { id: 'exercise', label: '💪 Exercise / Gym', icon: '💪', enabled: false, minutesPerDay: 60, timingMode: 'after-work', activityPreset: 'exercise', locationId: 'gym', daysOfWeek: MWF },
]

const DEFAULT_SETTINGS: UserSettings = {
  sleep: { hoursPerNight: 8, bedtime: '23:00' },
  work: {
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    label: 'Work',
    locationId: WORK_ID,
  },
  familyMinutesPerDay: 60,
  fixedBlocks: DEFAULT_FIXED_BLOCKS,
  timeSensitiveTasks: [],
  locations: DEFAULT_LOCATIONS,
  commuteMatrix: DEFAULT_MATRIX,
  homeLocationId: HOME_ID,
  endDayAtHome: true,
  dayOverrides: {},
  bufferOverrides: {},
  timeOverrides: {},
  bufferMinutes: 5,
  onboardingComplete: false,
}

function createBlockFromPreset(preset: ActivityPreset, homeId: string): FixedBlock {
  const def = ACTIVITY_PRESETS.find((p) => p.value === preset) ?? ACTIVITY_PRESETS[0]!
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: `${def.icon} ${def.label}`,
    icon: def.icon,
    enabled: true,
    minutesPerDay: def.defaultMinutes,
    timingMode: def.defaultTiming,
    customStartTime: def.defaultStartTime,
    activityPreset: def.value,
    locationId: homeId,
  }
}

/** endeavorId → total minutes completed across accepted chunk sessions.
 *  Remaining = estimatedMinutes - (total % estimatedMinutes), cycling on completion. */
export type EndeavorProgress = Record<string, number>

interface AppState {
  settings: UserSettings
  customEvents: CalendarEvent[]
  endeavors: Endeavor[]
  theme: 'dark' | 'light'
  productivityLog: ProductivityLog
  recommendations: Recommendation[]
  endeavorProgress: EndeavorProgress

  updateSettings: (patch: Partial<UserSettings>) => void
  completeOnboarding: () => void
  addCustomEvent: (event: CalendarEvent) => void
  removeCustomEvent: (id: string) => void
  editCustomEvent: (id: string, patch: Partial<CalendarEvent>) => void
  addEndeavor: (endeavor: Endeavor) => void
  updateEndeavor: (id: string, patch: Partial<Endeavor>) => void
  removeEndeavor: (id: string) => void
  toggleTheme: () => void
  markProductiveDay: (dateKey: string, freeMinutes: number) => void
  unmarkProductiveDay: (dateKey: string) => void
  setRecommendationStatus: (id: string, status: Recommendation['status']) => void
  acceptRecommendation: (id: string) => void
  generateWeekRecs: (weekStart?: Date) => void
  resetEndeavorProgress: (endeavorId: string) => void

  toggleFixedBlock: (blockId: string) => void
  updateFixedBlock: (blockId: string, patch: Partial<FixedBlock>) => void
  addFixedBlockFromPreset: (preset: ActivityPreset) => void
  removeFixedBlock: (blockId: string) => void

  addLocation: (name: string, icon: string) => string
  updateLocation: (id: string, patch: Partial<Omit<Location, 'id'>>) => void
  removeLocation: (id: string) => void
  setCommute: (a: string, b: string, minutes: number) => void
  setEndDayAtHome: (value: boolean) => void

  setDayOverride: (dateKey: string, activityId: string, enabled: boolean) => void
  clearDayOverride: (dateKey: string, activityId: string) => void
  clearAllDayOverrides: (dateKey: string) => void
  setRangeOverride: (
    startDateKey: string,
    scope: 'week' | 'future',
    activityId: string,
    enabled: boolean
  ) => void

  setBufferMinutes: (minutes: number) => void
  setBufferOverride: (dateKey: string, activityId: string, minutes: number) => void
  clearBufferOverride: (dateKey: string, activityId: string) => void

  setTimeOverride: (
    dateKey: string,
    activityId: string,
    override: { startTime: string; durationMinutes?: number; endTime?: string }
  ) => void
  clearTimeOverride: (dateKey: string, activityId: string) => void

  restoreDaySnapshot: (snapshot: DaySnapshot) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      customEvents: [],
      endeavors: [],
      theme: 'dark',
      productivityLog: {},
      recommendations: [],
      endeavorProgress: {},

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      completeOnboarding: () =>
        set((s) => ({ settings: { ...s.settings, onboardingComplete: true } })),

      addCustomEvent: (event) =>
        set((s) => ({ customEvents: [...s.customEvents, event] })),

      removeCustomEvent: (id) =>
        set((s) => ({ customEvents: s.customEvents.filter((e) => e.id !== id) })),

      editCustomEvent: (id, patch) =>
        set((s) => ({
          customEvents: s.customEvents.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      markProductiveDay: (dateKey, freeMinutes) =>
        set((s) => ({
          productivityLog: { ...s.productivityLog, [dateKey]: freeMinutes },
        })),

      unmarkProductiveDay: (dateKey) =>
        set((s) => {
          const { [dateKey]: _drop, ...rest } = s.productivityLog
          return { productivityLog: rest }
        }),

      setRecommendationStatus: (id, status) =>
        set((s) => ({
          recommendations: s.recommendations.map((r) =>
            r.id === id ? { ...r, status } : r
          ),
        })),

      acceptRecommendation: (id) =>
        set((s) => {
          const rec = s.recommendations.find((r) => r.id === id)
          if (!rec) return s
          const start = new Date(`${rec.dateKey}T00:00:00`)
          const eventStart = new Date(start.getTime() + rec.startMin * 60_000)
          const eventEnd = new Date(start.getTime() + rec.endMin * 60_000)
          const newEvent: CalendarEvent = {
            id: `user-${rec.id}`,
            title: rec.title,
            start: eventStart,
            end: eventEnd,
            type: 'user',
            priority: rec.priority,
            resource: {
              category: rec.category,
              fromRecommendation: true,
              endeavorId: rec.endeavorId,
              endeavorColor: rec.endeavorColor,
            },
          }
          // Track completed minutes for endeavor chunk cycling
          const sessionMinutes = rec.endMin - rec.startMin
          const prog = s.endeavorProgress ?? {}
          const nextProgress = rec.endeavorId
            ? {
                ...prog,
                [rec.endeavorId]: (prog[rec.endeavorId] ?? 0) + sessionMinutes,
              }
            : prog
          return {
            customEvents: [...s.customEvents, newEvent],
            recommendations: s.recommendations.map((r) =>
              r.id === id ? { ...r, status: 'accepted' as const } : r
            ),
            endeavorProgress: nextProgress,
          }
        }),

      resetEndeavorProgress: (endeavorId) =>
        set((s) => {
          const { [endeavorId]: _drop, ...rest } = s.endeavorProgress ?? {}
          return { endeavorProgress: rest }
        }),

      generateWeekRecs: (weekStart) => {
        // Sunday-based week to match the calendar's display
        const ws = weekStart ?? startOfWeek(new Date(), { weekStartsOn: 0 })
        set((s) => {
          const endeavorIds = new Set(s.endeavors.map((e) => e.id))

          // Build per-day occupied ranges (fixed schedule + user customEvents)
          // so we can invalidate any pending/maybe rec that now overlaps a
          // real event. Manual events always win over suggestions.
          const occupiedByDay = new Map<
            string,
            Array<{ startMin: number; endMin: number }>
          >()
          const rangesForDay = (key: string) => {
            const cached = occupiedByDay.get(key)
            if (cached) return cached
            const d = new Date(`${key}T00:00:00`)
            const fromSchedule = buildDaySchedule(s.settings, d).map((i) => ({
              startMin: Math.max(0, i.startMin),
              endMin: Math.min(1440, i.endMin),
            }))
            const fromCustom: Array<{ startMin: number; endMin: number }> = []
            for (const e of s.customEvents) {
              const sKey = format(e.start, 'yyyy-MM-dd')
              const eKey = format(e.end, 'yyyy-MM-dd')
              if (sKey !== key && eKey !== key) continue
              const startMin = sKey === key ? e.start.getHours() * 60 + e.start.getMinutes() : 0
              const endMin = eKey === key ? e.end.getHours() * 60 + e.end.getMinutes() : 1440
              if (endMin > startMin) fromCustom.push({ startMin, endMin })
            }
            const merged = [...fromSchedule, ...fromCustom].filter(
              (r) => r.endMin > r.startMin
            )
            occupiedByDay.set(key, merged)
            return merged
          }

          const overlapsReal = (r: Recommendation): boolean => {
            for (const range of rangesForDay(r.dateKey)) {
              if (r.startMin < range.endMin && r.endMin > range.startMin) return true
            }
            return false
          }

          // Wipe ALL pending/maybe suggestions on every rebuild so the new
          // state of endeavors (adds/removes/priority/time edits) and manual
          // events always produces a fresh, correct set. Accepted/declined
          // recs are kept as historical records. This also guarantees the
          // round-robin through endeavors redistributes so newly-added goals
          // actually get airtime instead of being blocked by stale ids.
          void endeavorIds
          void overlapsReal
          const pruned = s.recommendations.filter(
            (r) => r.status !== 'pending' && r.status !== 'maybe'
          )

          // Generate for target week + 2 more so navigating forward always has
          // suggestions without the user needing to trigger another action.
          const allNew: Recommendation[] = []
          let running = [...pruned]
          for (let w = 0; w < 3; w++) {
            const weekRecs = generateWeeklyRecommendations(
              s.settings,
              s.endeavors,
              addWeeks(ws, w),
              running,
              s.customEvents,
              s.endeavorProgress
            )
            allNew.push(...weekRecs)
            running = [...running, ...weekRecs]
          }
          const existingIds = new Set(pruned.map((r) => r.id))
          const toAdd = allNew.filter((r) => !existingIds.has(r.id))
          return { recommendations: [...pruned, ...toAdd] }
        })
      },

      addEndeavor: (endeavor) =>
        set((s) => ({ endeavors: [...s.endeavors, endeavor] })),

      updateEndeavor: (id, patch) =>
        set((s) => ({
          endeavors: s.endeavors.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      removeEndeavor: (id) =>
        set((s) => {
          const { [id]: _drop, ...restProgress } = s.endeavorProgress ?? {}
          return {
            endeavors: s.endeavors.filter((e) => e.id !== id),
            // Drop any outstanding suggestions that point at this endeavor so
            // the calendar doesn't keep proposing a deleted goal. Accepted recs
            // are preserved since they're already on the calendar as user events.
            recommendations: s.recommendations.filter(
              (r) =>
                r.endeavorId !== id ||
                (r.status !== 'pending' && r.status !== 'maybe')
            ),
            endeavorProgress: restProgress,
          }
        }),

      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      toggleFixedBlock: (blockId) =>
        set((s) => ({
          settings: {
            ...s.settings,
            fixedBlocks: s.settings.fixedBlocks.map((b) =>
              b.id === blockId ? { ...b, enabled: !b.enabled } : b
            ),
          },
        })),

      updateFixedBlock: (blockId, patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            fixedBlocks: s.settings.fixedBlocks.map((b) =>
              b.id === blockId ? { ...b, ...patch } : b
            ),
          },
        })),

      addFixedBlockFromPreset: (preset) =>
        set((s) => ({
          settings: {
            ...s.settings,
            fixedBlocks: [
              ...s.settings.fixedBlocks,
              createBlockFromPreset(preset, s.settings.homeLocationId),
            ],
          },
        })),

      removeFixedBlock: (blockId) =>
        set((s) => ({
          settings: {
            ...s.settings,
            fixedBlocks: s.settings.fixedBlocks.filter((b) => b.id !== blockId),
          },
        })),

      addLocation: (name, icon) => {
        const id = `loc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        set((s) => ({
          settings: {
            ...s.settings,
            locations: [...s.settings.locations, { id, name, icon }],
          },
        }))
        return id
      },

      updateLocation: (id, patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            locations: s.settings.locations.map((l) =>
              l.id === id ? { ...l, ...patch } : l
            ),
          },
        })),

      removeLocation: (id) =>
        set((s) => {
          if (id === s.settings.homeLocationId) return s
          const homeId = s.settings.homeLocationId
          return {
            settings: {
              ...s.settings,
              locations: s.settings.locations.filter((l) => l.id !== id),
              commuteMatrix: removeLocationFromMatrix(s.settings.commuteMatrix, id),
              work:
                s.settings.work.locationId === id
                  ? { ...s.settings.work, locationId: homeId }
                  : s.settings.work,
              fixedBlocks: s.settings.fixedBlocks.map((b) =>
                b.locationId === id ? { ...b, locationId: homeId } : b
              ),
            },
          }
        }),

      setCommute: (a, b, minutes) =>
        set((s) => ({
          settings: {
            ...s.settings,
            commuteMatrix: setCommuteMinutes(s.settings.commuteMatrix, a, b, minutes),
          },
        })),

      setEndDayAtHome: (value) =>
        set((s) => ({ settings: { ...s.settings, endDayAtHome: value } })),

      setDayOverride: (dateKey, activityId, enabled) =>
        set((s) => {
          const existing = s.settings.dayOverrides[dateKey] ?? {}
          return {
            settings: {
              ...s.settings,
              dayOverrides: {
                ...s.settings.dayOverrides,
                [dateKey]: { ...existing, [activityId]: enabled },
              },
            },
          }
        }),

      clearDayOverride: (dateKey, activityId) =>
        set((s) => {
          const existing = s.settings.dayOverrides[dateKey]
          if (!existing || !(activityId in existing)) return s
          const { [activityId]: _drop, ...rest } = existing
          const nextOverrides = { ...s.settings.dayOverrides }
          if (Object.keys(rest).length === 0) {
            delete nextOverrides[dateKey]
          } else {
            nextOverrides[dateKey] = rest
          }
          return { settings: { ...s.settings, dayOverrides: nextOverrides } }
        }),

      clearAllDayOverrides: (dateKey) =>
        set((s) => {
          if (!(dateKey in s.settings.dayOverrides)) return s
          const { [dateKey]: _drop, ...rest } = s.settings.dayOverrides
          return { settings: { ...s.settings, dayOverrides: rest } }
        }),

      setRangeOverride: (startDateKey, scope, activityId, enabled) =>
        set((s) => {
          const start = new Date(`${startDateKey}T00:00:00`)
          const days = scope === 'week' ? 7 : 365
          const next = { ...s.settings.dayOverrides }
          for (let i = 0; i < days; i++) {
            const d = new Date(start)
            d.setDate(d.getDate() + i)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            next[key] = { ...(next[key] ?? {}), [activityId]: enabled }
          }
          return { settings: { ...s.settings, dayOverrides: next } }
        }),

      setBufferMinutes: (minutes) =>
        set((s) => ({
          settings: { ...s.settings, bufferMinutes: Math.max(0, Math.min(60, minutes)) },
        })),

      setBufferOverride: (dateKey, activityId, minutes) =>
        set((s) => {
          const existing = s.settings.bufferOverrides[dateKey] ?? {}
          return {
            settings: {
              ...s.settings,
              bufferOverrides: {
                ...s.settings.bufferOverrides,
                [dateKey]: { ...existing, [activityId]: Math.max(0, Math.min(60, minutes)) },
              },
            },
          }
        }),

      clearBufferOverride: (dateKey, activityId) =>
        set((s) => {
          const existing = s.settings.bufferOverrides[dateKey]
          if (!existing || !(activityId in existing)) return s
          const { [activityId]: _drop, ...rest } = existing
          const next = { ...s.settings.bufferOverrides }
          if (Object.keys(rest).length === 0) delete next[dateKey]
          else next[dateKey] = rest
          return { settings: { ...s.settings, bufferOverrides: next } }
        }),

      setTimeOverride: (dateKey, activityId, override) =>
        set((s) => {
          const existing = s.settings.timeOverrides?.[dateKey] ?? {}
          return {
            settings: {
              ...s.settings,
              timeOverrides: {
                ...(s.settings.timeOverrides ?? {}),
                [dateKey]: { ...existing, [activityId]: override },
              },
            },
          }
        }),

      clearTimeOverride: (dateKey, activityId) =>
        set((s) => {
          const existing = s.settings.timeOverrides?.[dateKey]
          if (!existing || !(activityId in existing)) return s
          const { [activityId]: _drop, ...rest } = existing
          const next = { ...(s.settings.timeOverrides ?? {}) }
          if (Object.keys(rest).length === 0) delete next[dateKey]
          else next[dateKey] = rest
          return { settings: { ...s.settings, timeOverrides: next } }
        }),

      restoreDaySnapshot: (snapshot) =>
        set((s) => {
          const nextDay = { ...s.settings.dayOverrides }
          const nextBuf = { ...s.settings.bufferOverrides }
          const nextTime = { ...(s.settings.timeOverrides ?? {}) }

          for (const { dateKey, dayOverrides, bufferOverrides, timeOverrides } of snapshot.days) {
            if (Object.keys(dayOverrides).length === 0) delete nextDay[dateKey]
            else nextDay[dateKey] = dayOverrides

            if (Object.keys(bufferOverrides).length === 0) delete nextBuf[dateKey]
            else nextBuf[dateKey] = bufferOverrides

            if (Object.keys(timeOverrides).length === 0) delete nextTime[dateKey]
            else nextTime[dateKey] = timeOverrides
          }

          return {
            settings: {
              ...s.settings,
              dayOverrides: nextDay,
              bufferOverrides: nextBuf,
              timeOverrides: nextTime,
            },
          }
        }),
    }),
    {
      name: 'freeslot-storage',
      version: 10,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings ?? {}) },
        }
      },
      migrate: (persisted: any, version: number) => {
        if (!persisted?.settings) return persisted

        if (version < 2 && persisted.settings.fixedBlocks) {
          persisted.settings.fixedBlocks = persisted.settings.fixedBlocks.map((b: any) => ({
            ...b,
            timingMode: b.timingMode ?? 'custom',
            customStartTime: b.customStartTime ?? '12:00',
          }))
        }

        if (version < 4) {
          // Introduce locations + commute matrix
          const workCommuteMins =
            persisted.settings.work?.commute?.minutesEachWay ?? 30
          persisted.settings.locations = DEFAULT_LOCATIONS
          persisted.settings.commuteMatrix = {
            [canonicalKey(HOME_ID, WORK_ID)]: workCommuteMins,
            [canonicalKey(HOME_ID, 'gym')]: 15,
            [canonicalKey(WORK_ID, 'gym')]: 15,
          }
          persisted.settings.homeLocationId = HOME_ID
          persisted.settings.endDayAtHome = true

          // Migrate work: drop commute sub-object, add locationId
          if (persisted.settings.work) {
            const { commute: _drop, ...workRest } = persisted.settings.work
            persisted.settings.work = { ...workRest, locationId: WORK_ID }
          }

          // Migrate fixed blocks: drop per-block commute, add locationId
          persisted.settings.fixedBlocks = (persisted.settings.fixedBlocks ?? [])
            .filter((b: any) => b.id !== 'commute')
            .map((b: any) => {
              const hadOffsiteCommute = b.commute?.enabled
              const { commute: _drop, ...rest } = b
              return {
                ...rest,
                activityPreset: rest.activityPreset ?? 'custom',
                locationId:
                  hadOffsiteCommute && rest.activityPreset === 'exercise'
                    ? 'gym'
                    : HOME_ID,
              }
            })

          // Migrate time-sensitive tasks
          persisted.settings.timeSensitiveTasks = (
            persisted.settings.timeSensitiveTasks ?? []
          ).map((t: any) => ({ ...t, locationId: t.locationId ?? HOME_ID }))
        }

        if (version < 5) {
          persisted.settings.dayOverrides = persisted.settings.dayOverrides ?? {}
          persisted.settings.fixedBlocks = (persisted.settings.fixedBlocks ?? []).map(
            (b: any) => ({
              ...b,
              daysOfWeek: b.daysOfWeek ?? EVERY_DAY,
            })
          )
        }

        if (version < 6) {
          persisted.settings.bufferMinutes = persisted.settings.bufferMinutes ?? 5
          persisted.settings.bufferOverrides = persisted.settings.bufferOverrides ?? {}
        }

        if (version < 7) {
          persisted.settings.timeOverrides = persisted.settings.timeOverrides ?? {}
        }

        if (version < 8) {
          persisted.productivityLog = persisted.productivityLog ?? {}
          persisted.recommendations = persisted.recommendations ?? []
        }

        if (version < 9) {
          persisted.endeavorProgress = persisted.endeavorProgress ?? {}
        }

        if (version < 10) {
          // Earlier versions treated sleep as a generic fixed event, so the
          // "Skip just today" UI could write dayOverrides[key].sleep = false
          // and silently suppress sleep rendering. Sleep now has its own event
          // type with no skip affordance — scrub any stale false entries.
          const dayOvs = persisted.settings.dayOverrides ?? {}
          for (const key of Object.keys(dayOvs)) {
            const bucket = dayOvs[key]
            if (bucket && bucket.sleep === false) {
              const { sleep: _drop, ...rest } = bucket
              if (Object.keys(rest).length === 0) delete dayOvs[key]
              else dayOvs[key] = rest
            }
          }
          persisted.settings.dayOverrides = dayOvs
        }

        return persisted
      },
    }
  )
)
