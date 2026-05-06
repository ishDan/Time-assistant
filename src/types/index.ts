export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=Sun, 6=Sat

export interface SleepSettings {
  hoursPerNight: number
  bedtime: string // "HH:MM" 24h
}

export interface Location {
  id: string
  name: string
  icon: string
}

/**
 * Commute durations are stored undirected:
 *   key = canonical pair (sorted ids joined by "|"), value = minutes.
 * The scheduling engine derives two directional legs from each entry.
 */
export type CommuteMatrix = Record<string, number>

export interface WorkSettings {
  startTime: string // "HH:MM"
  endTime: string   // "HH:MM"
  daysOfWeek: DayOfWeek[]
  label: string
  locationId: string
}

export type TimingMode =
  | 'before-work'
  | 'after-work'
  | 'morning'
  | 'midday'
  | 'evening'
  | 'custom'

export type ActivityPreset =
  | 'exercise'
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'personal-care'
  | 'chores'
  | 'laundry'
  | 'gardening'
  | 'reading'
  | 'meditation'
  | 'walk'
  | 'errands'
  | 'study'
  | 'social'
  | 'custom'

export interface FixedBlock {
  id: string
  label: string
  icon: string
  enabled: boolean
  minutesPerDay: number
  timingMode: TimingMode
  customStartTime?: string
  daysOfWeek?: DayOfWeek[]
  activityPreset: ActivityPreset
  locationId: string
}

export interface TimeSensitiveTask {
  id: string
  name: string
  windowStart: string
  windowEnd: string
  daysOfWeek: DayOfWeek[]
  durationMinutes: number
  locationId: string
}

/**
 * Per-day overrides. Key = "YYYY-MM-DD", inner key = activity id ('work' or block.id),
 * value = true (force-enable for this day) or false (force-disable for this day).
 * Absent keys fall back to the activity's default weekly schedule.
 */
export type DayOverrides = Record<string, Record<string, boolean>>

/**
 * Per-day buffer duration overrides. Key = "YYYY-MM-DD", inner key = activity id
 * (buffer "belongs to" the activity it precedes). Value in minutes; 0 removes
 * the buffer for that day, absent falls back to the global default.
 */
export type BufferOverrides = Record<string, Record<string, number>>

/**
 * Per-day time overrides. Key = "YYYY-MM-DD", inner key = activity id.
 * startTime (required) is "HH:MM" clock time. Exactly one of durationMinutes
 * or endTime may be provided; if both absent, the activity's default duration
 * is used. A value here means "for this single day, run the activity at these
 * times" — the weekly template is untouched.
 */
export interface TimeOverride {
  startTime: string
  durationMinutes?: number
  endTime?: string
}
export type TimeOverrides = Record<string, Record<string, TimeOverride>>

export const WORK_ACTIVITY_ID = 'work'

export interface UserSettings {
  sleep: SleepSettings
  work: WorkSettings
  familyMinutesPerDay: number
  fixedBlocks: FixedBlock[]
  timeSensitiveTasks: TimeSensitiveTask[]
  locations: Location[]
  commuteMatrix: CommuteMatrix
  homeLocationId: string
  endDayAtHome: boolean
  dayOverrides: DayOverrides
  bufferOverrides: BufferOverrides
  timeOverrides: TimeOverrides
  bufferMinutes: number
  onboardingComplete: boolean
}

export type EventType = 'fixed' | 'free' | 'user' | 'endeavor' | 'commute' | 'buffer' | 'recommendation' | 'sleep'

export type Priority = 'low' | 'medium' | 'high'

export type RecommendationStatus = 'pending' | 'accepted' | 'declined' | 'maybe'

export interface Recommendation {
  id: string
  dateKey: string
  startMin: number
  endMin: number
  title: string
  category: string
  priority: Priority
  status: RecommendationStatus
  generatedAt: string
  /** True when this slot is a partial chunk of a longer activity */
  isChunk?: boolean
  /** Remaining minutes in the current cycle (only set when isChunk=true) */
  fullDurationMinutes?: number
  /** Original session length from the Endeavor definition */
  endeavorEstimatedMinutes?: number
  /** Planner endeavor this recommendation was generated from */
  endeavorId?: string
  /** Endeavor color for calendar block (hex) */
  endeavorColor?: string
}

/** dateKey → free minutes confirmed productive */
export type ProductivityLog = Record<string, number>

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: EventType
  endeavorId?: string
  parentId?: string
  allDay?: boolean
  resource?: Record<string, unknown>
  /** Extra fields for user-created custom events */
  location?: string
  notes?: string
  priority?: Priority
}

export interface Endeavor {
  id: string
  name: string
  description?: string
  estimatedMinutes: number
  preferredTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'any'
  color: string
  createdAt: string
  priority?: Priority
}

export interface FreeTimeSummary {
  todayFreeMinutes: number
  weekFreeMinutes: number
  yearRemainingFreeHours: number
  sessionsUntilYearEnd: (sessionMinutes: number) => number
}

export interface ActivityPresetDef {
  value: ActivityPreset
  label: string
  icon: string
  defaultMinutes: number
  defaultTiming: TimingMode
  defaultStartTime?: string
  usuallyOffsite: boolean
}

export const ACTIVITY_PRESETS: ActivityPresetDef[] = [
  { value: 'exercise', label: 'Exercise / Gym', icon: '💪', defaultMinutes: 60, defaultTiming: 'after-work', usuallyOffsite: true },
  { value: 'breakfast', label: 'Breakfast', icon: '🍳', defaultMinutes: 20, defaultTiming: 'morning', defaultStartTime: '07:30', usuallyOffsite: false },
  { value: 'lunch', label: 'Lunch', icon: '🥗', defaultMinutes: 30, defaultTiming: 'midday', defaultStartTime: '12:30', usuallyOffsite: false },
  { value: 'dinner', label: 'Dinner', icon: '🍽️', defaultMinutes: 45, defaultTiming: 'evening', defaultStartTime: '18:30', usuallyOffsite: false },
  { value: 'personal-care', label: 'Personal Care / Shower', icon: '🚿', defaultMinutes: 30, defaultTiming: 'morning', defaultStartTime: '07:00', usuallyOffsite: false },
  { value: 'chores', label: 'Chores', icon: '🧹', defaultMinutes: 30, defaultTiming: 'after-work', usuallyOffsite: false },
  { value: 'laundry', label: 'Laundry', icon: '🫧', defaultMinutes: 20, defaultTiming: 'evening', defaultStartTime: '20:00', usuallyOffsite: false },
  { value: 'gardening', label: 'Gardening / Yard work', icon: '🌱', defaultMinutes: 30, defaultTiming: 'after-work', usuallyOffsite: false },
  { value: 'reading', label: 'Reading', icon: '📚', defaultMinutes: 30, defaultTiming: 'evening', defaultStartTime: '21:00', usuallyOffsite: false },
  { value: 'meditation', label: 'Meditation', icon: '🧘', defaultMinutes: 15, defaultTiming: 'morning', defaultStartTime: '06:45', usuallyOffsite: false },
  { value: 'walk', label: 'Walk / Dog walk', icon: '🚶', defaultMinutes: 30, defaultTiming: 'morning', defaultStartTime: '07:00', usuallyOffsite: false },
  { value: 'errands', label: 'Errands / Shopping', icon: '🛒', defaultMinutes: 45, defaultTiming: 'after-work', usuallyOffsite: true },
  { value: 'study', label: 'Study / Class', icon: '🎓', defaultMinutes: 60, defaultTiming: 'evening', defaultStartTime: '19:00', usuallyOffsite: true },
  { value: 'social', label: 'Social / Friends', icon: '🤝', defaultMinutes: 90, defaultTiming: 'evening', defaultStartTime: '19:30', usuallyOffsite: true },
  { value: 'custom', label: 'Custom…', icon: '✨', defaultMinutes: 30, defaultTiming: 'custom', defaultStartTime: '12:00', usuallyOffsite: false },
]

export const LOCATION_ICON_OPTIONS = ['🏠', '💼', '💪', '🛒', '🎓', '☕', '🏥', '🏞️', '⛪', '🎭', '👨‍👩‍👧', '📍']
