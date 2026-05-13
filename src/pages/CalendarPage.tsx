import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay, isSameWeek } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { Plus, CalendarDays, List, Film, Coffee, Stethoscope, X, CheckCircle2, Pencil, RefreshCw, Copy } from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAppStore, type DaySnapshot } from '@/store/useAppStore'
import { generateRecurringEvents, recommendationsToEvents } from '@/utils/calendarHelpers'
import { buildFreeTimeSummary, formatFreeTime, calcDailyFreeMinutes } from '@/utils/freeTimeEngine'
import { resolvedActivityTime } from '@/utils/daySchedule'
import { DayFlowPanel } from '@/components/DayFlowPanel'
import { TrophyAnimation } from '@/components/TrophyAnimation'
import { QuickAddDialog, type QuickAddDraft, type QuickAddSubmit } from '@/components/QuickAddDialog'
import { snapToFreeSlot, minutesToDate } from '@/utils/freeSlotSnap'
import type { CalendarEvent, Priority } from '@/types'

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales })
const DnDCalendar = withDragAndDrop(Calendar as any)

const QUICK_ADD_ITEMS = [
  { icon: Film, label: 'Movie night', duration: 150 },
  { icon: Coffee, label: 'Coffee date', duration: 60 },
  { icon: Stethoscope, label: 'Appointment', duration: 60 },
]

function eventPropGetter(event: CalendarEvent) {
  const resource = (event.resource ?? {}) as Record<string, unknown>

  const baseColors: Record<string, Record<string, string | number>> = {
    sleep:    { backgroundColor: 'hsl(215 20% 35%)', border: 'transparent' },
    fixed:    { backgroundColor: 'hsl(215 20% 35%)', border: 'transparent' },
    free:     { backgroundColor: 'hsl(142 76% 28%)', border: 'transparent' },
    user:     { backgroundColor: 'hsl(210 100% 40%)', border: 'transparent' },
    endeavor: { backgroundColor: 'hsl(280 65% 45%)', border: 'transparent' },
    commute:  { backgroundColor: 'hsl(30 85% 45%)', border: 'transparent', opacity: 0.75 },
    buffer: {
      backgroundColor: 'hsl(142 60% 88% / 0.9)',
      border: '1px dashed hsl(142 50% 45%)',
      backgroundImage: 'none',
    },
    recommendation: {
      backgroundColor: '#c4b5fd',
      border: '2px dashed #7c3aed',
      backgroundImage: 'none',
      opacity: 0.9,
    },
  }

  const style = { ...(baseColors[event.type] ?? baseColors.user) } as any

  // Tint recommendation block with the endeavor's own color when available
  if (event.type === 'recommendation' && resource.endeavorColor) {
    const hex = resource.endeavorColor as string
    style.backgroundColor = hex + 'aa'    // 67% opacity
    style.border = `2px dashed ${hex}`
    style.opacity = 1
  }

  const priorityAccent: Record<Priority, string> = {
    high: 'hsl(0 70% 55%)',
    medium: 'hsl(38 90% 50%)',
    low: 'hsl(142 60% 45%)',
  }
  if (event.type === 'user' && event.priority) {
    style.borderLeft = `3px solid ${priorityAccent[event.priority]}`
  }

  return {
    style,
    className: event.type === 'buffer'
      ? 'rbc-buffer-event'
      : event.type === 'recommendation'
      ? 'rbc-recommendation-event'
      : '',
  }
}

/**
 * Portals a current-time label into the RBC time gutter so it sits flush
 * against the red line, scrolling with it — exactly like Apple Calendar.
 * Updates every 30 s; hides automatically when the indicator is absent
 * (i.e. in month/agenda view, or when navigating away from today).
 */
/**
 * Wraps the RBC time-gutter column and injects a live current-time label
 * at the correct vertical position. Using `components.timeGutterWrapper`
 * keeps the label inside RBC's own component tree so it scrolls correctly,
 * survives view switches without portal/ref invalidation, and needs no DOM
 * querying or MutationObservers.
 *
 * Position is computed as (minutesNow / 1440) × gutterHeight, matching the
 * fraction used by RBC's own `.rbc-current-time-indicator` line.
 */
function NowGutterWrapper({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [labelTop, setLabelTop] = useState<number | null>(null)
  const [label, setLabel] = useState('')
  const isToday = useRef(true)

  useEffect(() => {
    function tick() {
      const now = new Date()
      const todayCheck = new Date()
      isToday.current =
        now.toDateString() === todayCheck.toDateString()

      if (!ref.current) return
      const totalMin = 24 * 60
      const currentMin = now.getHours() * 60 + now.getMinutes()
      const ratio = currentMin / totalMin
      const height = ref.current.scrollHeight || ref.current.getBoundingClientRect().height
      setLabelTop(ratio * height)
      setLabel(format(now, 'h:mm a'))
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', height: '100%' }}>
      {children}
      {labelTop !== null && label && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: labelTop,
            right: 2,
            transform: 'translateY(-50%)',
            zIndex: 6,
            pointerEvents: 'none',
            backgroundColor: 'rgba(239,68,68,0.92)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 1,
            padding: '2px 5px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            letterSpacing: '0.01em',
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

function CalendarEventContent({ event }: { event: CalendarEvent }) {
  if (event.type === 'buffer') {
    const durationMin = Math.round(
      (event.end.getTime() - event.start.getTime()) / 60000
    )
    const fontSize = durationMin <= 5 ? 8 : durationMin <= 10 ? 9 : 10
    return (
      <span style={{ fontSize, lineHeight: 1, display: 'block', overflow: 'hidden',
        whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'hsl(142 50% 20%)', fontWeight: 600 }}>
        {event.title}
      </span>
    )
  }
  if (event.type === 'recommendation') {
    return (
      <span style={{ fontSize: 10, lineHeight: 1.2, display: 'block', overflow: 'hidden',
        whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: '#3b0764', fontWeight: 700 }}>
        {event.title}
      </span>
    )
  }
  return (
    <span style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap',
      textOverflow: 'ellipsis', lineHeight: 1.3 }}>
      {event.title}
    </span>
  )
}

export function CalendarPage() {
  const {
    settings,
    customEvents,
    endeavors,
    productivityLog,
    recommendations,
    addCustomEvent,
    removeCustomEvent,
    editCustomEvent,
    setDayOverride,
    setRangeOverride,
    setBufferOverride,
    clearBufferOverride,
    setTimeOverride,
    clearTimeOverride,
    markProductiveDay,
    unmarkProductiveDay,
    setRecommendationStatus,
    acceptRecommendation,
    generateWeekRecs,
    restoreDaySnapshot,
  } = useAppStore()

  // Week view is unusable on a phone — default to Day on small viewports.
  const [view, setView] = useState<(typeof Views)[keyof typeof Views]>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
      ? Views.DAY
      : Views.WEEK
  )
  const [date, setDate] = useState(new Date())
  const [selected, setSelected] = useState<CalendarEvent | null>(null)
  const [showTrophy, setShowTrophy] = useState(false)
  const [quickAddDraft, setQuickAddDraft] = useState<QuickAddDraft | null>(null)
  const [daySnapshot, setDaySnapshot] = useState<DaySnapshot | null>(null)
  const calendarWrapperRef = useRef<HTMLDivElement>(null)

  // Capture one or more days' override buckets before any edit so the user can
  // roll back. Pass multiple keys for cross-day drag (source + destination).
  const captureSnapshot = useCallback(
    (...keys: string[]) => {
      setDaySnapshot({
        days: keys.map((key) => ({
          dateKey: key,
          dayOverrides: { ...(settings.dayOverrides[key] ?? {}) },
          bufferOverrides: { ...(settings.bufferOverrides[key] ?? {}) },
          timeOverrides: { ...(settings.timeOverrides?.[key] ?? {}) },
        })),
      })
    },
    [settings]
  )

  const handleRestore = useCallback(() => {
    if (!daySnapshot) return
    restoreDaySnapshot(daySnapshot)
    setDaySnapshot(null)
  }, [daySnapshot, restoreDaySnapshot])

  // Wake time anchors the default scroll position so the tail end of sleep
  // is always visible when the calendar first mounts. Falls back to 5 AM.
  const scrollToTime = useMemo(() => {
    const [bh, bm] = (settings.sleep.bedtime ?? '23:00').split(':').map(Number)
    const bedMin = (bh ?? 23) * 60 + (bm ?? 0)
    const wakeMin = (bedMin + Math.round((settings.sleep.hoursPerNight ?? 8) * 60)) % 1440
    const anchor = Math.max(0, wakeMin - 120)  // 2 h before wake
    const d = new Date()
    d.setHours(Math.floor(anchor / 60), anchor % 60, 0, 0)
    return d
  }, [settings.sleep.bedtime, settings.sleep.hoursPerNight])

  // Track which week was last seeded so we only re-generate on actual week changes
  const lastSeededWeek = useRef<Date | null>(null)

  const seedRecsForDate = useCallback(
    (d: Date) => {
      const ws = startOfWeek(d, { weekStartsOn: 0 })
      if (lastSeededWeek.current && isSameWeek(ws, lastSeededWeek.current, { weekStartsOn: 0 })) return
      lastSeededWeek.current = ws
      generateWeekRecs(ws)
    },
    [generateWeekRecs]
  )

  // Seed on mount
  useEffect(() => {
    seedRecsForDate(new Date())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-generate whenever the user's endeavors change so new planner items
  // appear immediately as calendar suggestions
  useEffect(() => {
    lastSeededWeek.current = null  // force re-seed even for the same week
    seedRecsForDate(date)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endeavors.length])

  const summary = buildFreeTimeSummary(settings)

  const recurringEvents = useMemo(
    () => generateRecurringEvents(settings, 12),
    [settings]
  )

  const recEvents = useMemo(
    () => recommendationsToEvents(recommendations),
    [recommendations]
  )

  const allEvents = useMemo(
    () => [...recurringEvents, ...customEvents, ...recEvents],
    [recurringEvents, customEvents, recEvents]
  )

  const handleQuickAdd = useCallback(
    (label: string, duration: number) => {
      const start = new Date(); start.setMinutes(0, 0, 0)
      const end = new Date(start.getTime() + duration * 60_000)
      addCustomEvent({ id: `custom-${Date.now()}`, title: label, start, end, type: 'user' })
    },
    [addCustomEvent]
  )

  // Prefills the QuickAdd dialog with the selected event's title, duration,
  // location/notes/priority so the user only has to pick a new date/time and
  // save. The copy is always added as a user-owned custom event so it never
  // conflicts with the weekly template or per-day overrides of the source.
  const handleDuplicateEvent = useCallback(
    (event: CalendarEvent) => {
      const resource = (event.resource ?? {}) as { locationId?: string }
      setQuickAddDraft({
        start: event.start,
        end: event.end,
        snapped: false,
        title: event.title.replace(/^(💡|😴|💼|🚗|⋯)\s*/, '').trim(),
        locationId: event.location ?? resource.locationId,
        notes: event.notes,
        priority: event.priority,
        mode: 'duplicate',
      })
      setSelected(null)
    },
    []
  )

  // Drag-to-reschedule: move or resize an existing event.
  // - Custom (user) events  → update start/end directly via editCustomEvent.
  // - Fixed / endeavor events → apply a per-day time override so only that
  //   day changes; other days and other events are unaffected.
  // - Buffers, commutes, recommendations → not draggable (draggable=false on
  //   the event prop getter keeps the handle hidden, but guard here too).
  const handleEventDrop = useCallback(
    ({ event, start, end }: { event: object; start: Date | string; end: Date | string }) => {
      const ev = event as CalendarEvent
      const newStart = new Date(start)
      const newEnd = new Date(end)
      const destKey = format(newStart, 'yyyy-MM-dd')

      if (ev.type === 'user') {
        captureSnapshot(destKey)
        editCustomEvent(ev.id, { start: newStart, end: newEnd })
        return
      }

      const resource = (ev.resource ?? {}) as { activityId?: string; anchorDateKey?: string }
      const activityId = resource.activityId
      const sourceKey = resource.anchorDateKey ?? format(ev.start, 'yyyy-MM-dd')

      if ((ev.type === 'fixed' || ev.type === 'endeavor') && activityId) {
        const startTime = format(newStart, 'HH:mm')
        const durationMinutes = Math.round((newEnd.getTime() - newStart.getTime()) / 60_000)
        const crossDay = destKey !== sourceKey

        if (crossDay) {
          // Snapshot both days so rollback is complete.
          captureSnapshot(sourceKey, destKey)
          // Hide the event on the source day.
          setDayOverride(sourceKey, activityId, false)
          // Show it on the destination day at the new time.
          setTimeOverride(destKey, activityId, { startTime, durationMinutes })
          setDayOverride(destKey, activityId, true)
        } else {
          captureSnapshot(sourceKey)
          setTimeOverride(sourceKey, activityId, { startTime, durationMinutes })
          setDayOverride(sourceKey, activityId, true)
        }
      }
    },
    [captureSnapshot, editCustomEvent, setTimeOverride, setDayOverride]
  )

  const handleEventResize = useCallback(
    ({ event, start, end }: { event: object; start: Date | string; end: Date | string }) => {
      const ev = event as CalendarEvent
      const newStart = new Date(start)
      const newEnd = new Date(end)

      if (ev.type === 'user') {
        const key = format(newStart, 'yyyy-MM-dd')
        captureSnapshot(key)
        editCustomEvent(ev.id, { start: newStart, end: newEnd })
        return
      }

      const resource = (ev.resource ?? {}) as { activityId?: string; anchorDateKey?: string }
      const activityId = resource.activityId
      const sourceKey = resource.anchorDateKey ?? format(ev.start, 'yyyy-MM-dd')
      if ((ev.type === 'fixed' || ev.type === 'endeavor') && activityId) {
        captureSnapshot(sourceKey)
        const startTime = format(newStart, 'HH:mm')
        const durationMinutes = Math.round((newEnd.getTime() - newStart.getTime()) / 60_000)
        setTimeOverride(sourceKey, activityId, { startTime, durationMinutes })
        setDayOverride(sourceKey, activityId, true)
      }
    },
    [captureSnapshot, editCustomEvent, setTimeOverride, setDayOverride]
  )

  // Tap empty space OR drag-select a range → snap to free slot → open dialog.
  const handleSelectSlot = useCallback(
    (slot: { start: Date; end: Date; action?: string }) => {
      // Ignore selections that are coincident (react-big-calendar sometimes
      // fires these on click-through to events) — onSelectEvent handles those.
      if (slot.start.getTime() === slot.end.getTime()) return

      const snap = snapToFreeSlot(settings, customEvents, slot.start, slot.start, slot.end)
      const base = slot.start
      const snappedStart = minutesToDate(base, snap.startMin)
      const snappedEnd = minutesToDate(base, snap.endMin)

      setQuickAddDraft({
        start: snappedStart,
        end: snappedEnd,
        snapped: snap.snapped,
        noFreeSlot: snap.noFreeSlot,
      })
    },
    [settings, customEvents]
  )

  const handleQuickAddSubmit = useCallback(
    (v: QuickAddSubmit) => {
      // Re-snap on submit so any user edits to start/duration still respect
      // the schedule (buffers, commutes, existing events).
      const snap = snapToFreeSlot(settings, customEvents, v.start, v.start, v.end)
      const snappedStart = minutesToDate(v.start, snap.startMin)
      const snappedEnd = minutesToDate(v.start, snap.endMin)
      addCustomEvent({
        id: `custom-${Date.now()}`,
        title: v.title,
        start: snappedStart,
        end: snappedEnd,
        type: 'user',
        priority: v.priority,
        location: v.locationId,
        notes: v.notes,
        resource: { locationId: v.locationId, notes: v.notes },
      })
      setQuickAddDraft(null)
    },
    [addCustomEvent, settings, customEvents]
  )

  // Day-view productivity check
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const viewDateKey = format(date, 'yyyy-MM-dd')
  const isToday = viewDateKey === todayKey
  const isMarkedProductive = productivityLog[viewDateKey] !== undefined
  const freeMinutesForViewDay = useMemo(
    () => calcDailyFreeMinutes(settings, date),
    [settings, date]
  )

  const handleMarkProductive = () => {
    if (isMarkedProductive) {
      unmarkProductiveDay(viewDateKey)
    } else {
      markProductiveDay(viewDateKey, freeMinutesForViewDay)
      setShowTrophy(true)
    }
  }

  return (
    <div className="flex flex-col md:flex-row md:h-full -m-4 md:m-0">
      {showTrophy && <TrophyAnimation onDone={() => setShowTrophy(false)} />}

      <QuickAddDialog
        open={quickAddDraft !== null}
        draft={quickAddDraft}
        locations={settings.locations}
        homeLocationId={settings.homeLocationId}
        onCancel={() => setQuickAddDraft(null)}
        onSubmit={handleQuickAddSubmit}
      />

      <div className="flex-1 p-3 md:p-6 overflow-hidden flex flex-col min-h-[calc(100dvh-12rem)] md:min-h-0">
        <div className="mb-3 md:mb-4 flex items-start md:items-center justify-between flex-shrink-0 gap-2">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold">Calendar</h1>
            <p className="hidden md:block text-sm text-muted-foreground mt-0.5">
              {formatFreeTime(summary.todayFreeMinutes)} free today · {formatFreeTime(summary.weekFreeMinutes)} this week
            </p>
          </div>
          <div className="flex items-center gap-1 md:gap-2 flex-wrap justify-end">
            {view === Views.DAY && (
              <Button
                variant={isMarkedProductive ? 'default' : 'outline'}
                size="sm"
                className="gap-2 text-xs"
                onClick={handleMarkProductive}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{isMarkedProductive ? 'Productive Day ✓' : 'Used My Spare Time Today'}</span>
                <span className="sm:hidden">{isMarkedProductive ? 'Done ✓' : 'Log Day'}</span>
              </Button>
            )}
            <Button
              variant="ghost" size="icon"
              onClick={() => { lastSeededWeek.current = null; seedRecsForDate(date) }}
              aria-label="Refresh suggestions"
              title="Refresh suggestions"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setView(Views.DAY)} aria-label="Day view">
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setView(Views.MONTH)} aria-label="Month view">
              <CalendarDays className="h-4 w-4 opacity-50" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setView(Views.AGENDA)} aria-label="Agenda view">
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="hidden md:flex mb-3 items-center gap-4 text-xs text-muted-foreground flex-wrap flex-shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'hsl(215 20% 35%)' }} />Sleep
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-fixed" />Fixed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: 'hsl(30 85% 45%)' }} />Commute
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: 'hsl(142 60% 88% / 0.9)', border: '1px dashed hsl(142 50% 45%)' }} />Buffer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: '#c4b5fd', border: '2px dashed #7c3aed' }} />Suggested
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" />Your events
          </span>
          {view === Views.DAY && isMarkedProductive && (
            <span className="flex items-center gap-1 text-emerald-500 font-medium ml-auto">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Productive day logged · {formatFreeTime(productivityLog[viewDateKey]!)}
            </span>
          )}
        </div>

        {/* CSS overrides for special event types */}
        <style>{`
          .rbc-buffer-event { min-height: 0 !important; overflow: hidden !important; }
          .rbc-buffer-event .rbc-event-content { padding: 1px 3px !important; overflow: hidden !important; line-height: 1 !important; }
          @keyframes rec-pulse { 0%,100% { opacity:0.7; } 50% { opacity:1; } }
          .rbc-recommendation-event { animation: rec-pulse 2.2s ease-in-out infinite; }
          .rbc-recommendation-event .rbc-event-content { padding: 2px 4px !important; }
          /* Visual feedback while tap-selecting or dragging to create */
          .rbc-slot-selection {
            background: hsl(210 100% 55% / 0.18) !important;
            border: 2px solid hsl(210 100% 55% / 0.9) !important;
            border-radius: 6px !important;
            box-shadow: 0 0 0 3px hsl(210 100% 55% / 0.15) !important;
            color: hsl(210 100% 90%) !important;
            font-weight: 600 !important;
          }
          .rbc-day-slot .rbc-time-slot { cursor: pointer; }
        `}</style>

        <div ref={calendarWrapperRef} style={{ flex: 1, minHeight: 0 }}>
          <DnDCalendar
            localizer={localizer}
            events={allEvents}
            view={view}
            date={date}
            onView={(v: any) => setView(v)}
            onNavigate={(d: Date) => { setDate(d); seedRecsForDate(d) }}
            onSelectEvent={(e: any) => setSelected(e as CalendarEvent)}
            selectable
            onSelectSlot={handleSelectSlot}
            longPressThreshold={150}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            resizable
            draggableAccessor={(event: any) => {
              const e = event as CalendarEvent
              return e.type === 'user' || e.type === 'fixed' || e.type === 'endeavor'
            }}
            eventPropGetter={eventPropGetter as any}
            components={{ event: CalendarEventContent as any, timeGutterWrapper: NowGutterWrapper as any }}
            titleAccessor="title"
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            step={15}
            timeslots={4}
            scrollToTime={scrollToTime}
            popup
          />
        </div>
      </div>

      <aside className="hidden md:flex md:w-72 border-l border-border p-5 flex-col gap-4 overflow-y-auto">
        {selected && (
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm truncate flex-1">{selected.title}</CardTitle>
              <div className="flex items-center gap-1 shrink-0">
                {selected.type !== 'recommendation' &&
                  selected.type !== 'commute' &&
                  selected.type !== 'buffer' && (
                    <button
                      onClick={() => handleDuplicateEvent(selected)}
                      aria-label="Duplicate event"
                      title="Duplicate to another day / time"
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                <button onClick={() => setSelected(null)} aria-label="Close"
                  className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <EventActions
                event={selected}
                onClose={() => { setSelected(null); setDaySnapshot(null) }}
                onRemoveCustom={(id) => removeCustomEvent(id)}
                onEditCustom={(id, patch) => { editCustomEvent(id, patch); setSelected(null) }}
                onSkipToday={(key, id) => { captureSnapshot(key); setDayOverride(key, id, false) }}
                onSkipRange={(key, scope, id) => { captureSnapshot(key); setRangeOverride(key, scope, id, false) }}
                onEditBuffer={(key, id, m) => { captureSnapshot(key); setBufferOverride(key, id, m) }}
                onResetBuffer={(key, id) => { captureSnapshot(key); clearBufferOverride(key, id) }}
                onRetime={(key, id, startTime, durationMinutes) => {
                  captureSnapshot(key)
                  setTimeOverride(key, id, { startTime, durationMinutes })
                  setDayOverride(key, id, true)
                }}
                onResetTime={(key, id) => { captureSnapshot(key); clearTimeOverride(key, id) }}
                resolvedTime={(key, id) =>
                  resolvedActivityTime(settings, new Date(`${key}T00:00:00`), id)
                }
                hasTimeOverride={(key, id) =>
                  settings.timeOverrides?.[key]?.[id] !== undefined
                }
                onAcceptRec={(id) => { acceptRecommendation(id); generateWeekRecs(startOfWeek(new Date(), { weekStartsOn: 0 })); setSelected(null) }}
                onMaybeRec={(id) => { setRecommendationStatus(id, 'maybe'); setSelected(null) }}
                onDeclineRec={(id) => { setRecommendationStatus(id, 'declined'); setSelected(null) }}
                daySnapshot={daySnapshot}
                onRestoreSnapshot={handleRestore}
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quick Add</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {QUICK_ADD_ITEMS.map(({ icon: Icon, label, duration }) => (
              <button key={label} onClick={() => handleQuickAdd(label, duration)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors text-left">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </button>
            ))}
            <Button variant="outline" size="sm" className="w-full gap-2 mt-1"
              onClick={() => handleQuickAdd('New Event', 60)}>
              <Plus className="h-3.5 w-3.5" />Custom event
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Today's Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <DayFlowPanel date={isToday ? date : new Date()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Year Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{summary.yearRemainingFreeHours}h</p>
            <p className="text-xs text-muted-foreground mt-0.5">free hours left in {new Date().getFullYear()}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              That's <span className="font-semibold text-foreground">{summary.sessionsUntilYearEnd(60)}</span> hour-long sessions,
              or <span className="font-semibold text-foreground">{summary.sessionsUntilYearEnd(90)}</span> × 90-min sessions.
            </p>
          </CardContent>
        </Card>
      </aside>

      {/* ── Mobile: event detail bottom sheet ─────────────────────────── */}
      {selected && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-background border-t border-border rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold truncate flex-1 mr-2">{selected.title}</h3>
              <div className="flex items-center gap-1 shrink-0">
                {selected.type !== 'recommendation' &&
                  selected.type !== 'commute' &&
                  selected.type !== 'buffer' && (
                    <button
                      onClick={() => handleDuplicateEvent(selected)}
                      aria-label="Duplicate event"
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-accent"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                <button onClick={() => setSelected(null)} aria-label="Close"
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-accent">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <EventActions
              event={selected}
              onClose={() => { setSelected(null); setDaySnapshot(null) }}
              onRemoveCustom={(id) => removeCustomEvent(id)}
              onEditCustom={(id, patch) => { editCustomEvent(id, patch); setSelected(null) }}
              onSkipToday={(key, id) => { captureSnapshot(key); setDayOverride(key, id, false) }}
              onSkipRange={(key, scope, id) => { captureSnapshot(key); setRangeOverride(key, scope, id, false) }}
              onEditBuffer={(key, id, m) => { captureSnapshot(key); setBufferOverride(key, id, m) }}
              onResetBuffer={(key, id) => { captureSnapshot(key); clearBufferOverride(key, id) }}
              onRetime={(key, id, startTime, durationMinutes) => {
                captureSnapshot(key)
                setTimeOverride(key, id, { startTime, durationMinutes })
                setDayOverride(key, id, true)
              }}
              onResetTime={(key, id) => { captureSnapshot(key); clearTimeOverride(key, id) }}
              resolvedTime={(key, id) =>
                resolvedActivityTime(settings, new Date(`${key}T00:00:00`), id)
              }
              hasTimeOverride={(key, id) =>
                settings.timeOverrides?.[key]?.[id] !== undefined
              }
              onAcceptRec={(id) => { acceptRecommendation(id); generateWeekRecs(startOfWeek(new Date(), { weekStartsOn: 0 })); setSelected(null) }}
              onMaybeRec={(id) => { setRecommendationStatus(id, 'maybe'); setSelected(null) }}
              onDeclineRec={(id) => { setRecommendationStatus(id, 'declined'); setSelected(null) }}
              daySnapshot={daySnapshot}
              onRestoreSnapshot={handleRestore}
            />
          </div>
        </div>
      )}

      {/* ── Mobile: Quick Add FAB ──────────────────────────────────────── */}
      {!selected && (
        <button
          className="md:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          onClick={() => {
            const start = new Date()
            start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
            const end = new Date(start.getTime() + 60 * 60_000)
            setQuickAddDraft({ start, end, snapped: false })
          }}
          aria-label="Add event"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}

// ─── EventActions ─────────────────────────────────────────────────────────────

interface EventActionsProps {
  event: CalendarEvent
  onClose: () => void
  onRemoveCustom: (id: string) => void
  onEditCustom: (id: string, patch: Partial<CalendarEvent>) => void
  onSkipToday: (dateKey: string, activityId: string) => void
  onSkipRange: (dateKey: string, scope: 'week' | 'future', activityId: string) => void
  onEditBuffer: (dateKey: string, activityId: string, minutes: number) => void
  onResetBuffer: (dateKey: string, activityId: string) => void
  onRetime: (dateKey: string, activityId: string, startTime: string, durationMinutes: number) => void
  onResetTime: (dateKey: string, activityId: string) => void
  resolvedTime: (dateKey: string, activityId: string) => { startTime: string; durationMinutes: number } | null
  hasTimeOverride: (dateKey: string, activityId: string) => boolean
  onAcceptRec: (id: string) => void
  onMaybeRec: (id: string) => void
  onDeclineRec: (id: string) => void
  daySnapshot: DaySnapshot | null
  onRestoreSnapshot: () => void
}

function EventActions({
  event, onClose, onRemoveCustom, onEditCustom,
  onSkipToday, onSkipRange, onEditBuffer, onResetBuffer,
  onRetime, onResetTime, resolvedTime, hasTimeOverride,
  onAcceptRec, onMaybeRec, onDeclineRec,
  daySnapshot, onRestoreSnapshot,
}: EventActionsProps) {
  const resource = (event.resource ?? {}) as {
    kind?: string; activityId?: string; anchorDateKey?: string
    dateKey?: string; recommendationId?: string; status?: string
    isChunk?: boolean; fullDurationMinutes?: number; endeavorEstimatedMinutes?: number; category?: string
  }
  const dateKey = resource.anchorDateKey ?? resource.dateKey ?? format(event.start, 'yyyy-MM-dd')
  const duration = Math.round((event.end.getTime() - event.start.getTime()) / 60000)

  // ── Recommendation slot ──────────────────────────────────────────────────
  if (event.type === 'recommendation' && resource.recommendationId) {
    const recId = resource.recommendationId
    const isAccepted = resource.status === 'accepted'
    const isChunk = resource.isChunk ?? false
    const remainingMin = resource.fullDurationMinutes
    const cycleMin = resource.endeavorEstimatedMinutes

    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
          {isChunk ? (
            <p className="text-xs font-medium text-purple-400 uppercase tracking-wide">
              ✂ Chunk suggestion
            </p>
          ) : (
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Suggestion
            </p>
          )}
          <p className="text-sm font-semibold leading-snug">
            {event.title.replace('💡 ', '')}
          </p>
          <p className="text-xs text-muted-foreground">
            {format(event.start, 'p')} – {format(event.end, 'p')} · {duration}m
          </p>
          {remainingMin && cycleMin && (
            <div className="mt-2 space-y-1">
              {remainingMin < cycleMin && (
                <p className="text-[10px] text-purple-400 font-medium">
                  {cycleMin - remainingMin}m already done · {remainingMin}m remaining
                </p>
              )}
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>This session: {duration}m of {remainingMin}m remaining</span>
                <span>{Math.min(100, Math.round((duration / remainingMin) * 100))}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500"
                  style={{ width: `${Math.min(100, (duration / remainingMin) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                {duration >= remainingMin
                  ? `Completes this ${cycleMin}m cycle.`
                  : `${remainingMin - duration}m will remain after this session.`}
              </p>
            </div>
          )}
        </div>
        {!isAccepted && (
          <div className="space-y-1.5">
            <Button size="sm" className="w-full text-xs gap-2" onClick={() => onAcceptRec(recId)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {`Start ${duration}m session`}
            </Button>
            <Button size="sm" variant="outline" className="w-full text-xs"
              onClick={() => onMaybeRec(recId)}>
              Maybe later
            </Button>
            <Button size="sm" variant="ghost" className="w-full text-xs text-muted-foreground"
              onClick={() => onDeclineRec(recId)}>
              Decline
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ── Custom user event ────────────────────────────────────────────────────
  if (event.type === 'user') {
    return (
      <EditCustomEventForm
        event={event}
        onSave={(patch) => onEditCustom(event.id, patch)}
        onDelete={() => { onRemoveCustom(event.id); onClose() }}
      />
    )
  }

  // ── Buffer ───────────────────────────────────────────────────────────────
  if (event.type === 'buffer' && resource.activityId) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Buffer · {duration}m ({format(event.start, 'p')})</p>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} max={60} defaultValue={duration}
            onBlur={(e) => onEditBuffer(dateKey, resource.activityId!, Number(e.target.value))}
            className="h-8 w-20 text-xs" />
          <span className="text-xs text-muted-foreground">minutes</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs"
            onClick={() => { onEditBuffer(dateKey, resource.activityId!, 0); onClose() }}>
            Remove today
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 text-xs"
            onClick={() => { onResetBuffer(dateKey, resource.activityId!); onClose() }}>
            Reset
          </Button>
        </div>
      </div>
    )
  }

  // ── Commute ──────────────────────────────────────────────────────────────
  if (event.type === 'commute') {
    return (
      <p className="text-xs text-muted-foreground">
        Auto-inserted commute · {duration}m. Adjust by skipping the activity it
        precedes, or editing travel time in Settings.
      </p>
    )
  }

  // ── Fixed / endeavor activity ────────────────────────────────────────────
  if ((event.type === 'fixed' || event.type === 'endeavor') && resource.activityId) {
    const activityId = resource.activityId
    const current = resolvedTime(dateKey, activityId) ?? {
      startTime: format(event.start, 'HH:mm'),
      durationMinutes: duration,
    }
    const overridden = hasTimeOverride(dateKey, activityId)
    const snapshotIsForThisDay = daySnapshot?.days.some((d) => d.dateKey === dateKey) ?? false
    return (
      <div className="space-y-3">
        {snapshotIsForThisDay && (
          <button
            onClick={onRestoreSnapshot}
            className="flex w-full items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            <Pencil className="h-3 w-3 shrink-0" />
            Undo last change to this day
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          {format(event.start, 'p')} – {format(event.end, 'p')} · {duration}m
        </p>
        <RetimeForm
          initialStart={current.startTime}
          initialDuration={current.durationMinutes}
          overridden={overridden}
          onSave={(start, dur) => { onRetime(dateKey, activityId, start, dur); onClose() }}
          onReset={() => { onResetTime(dateKey, activityId); onClose() }}
        />
        <div className="border-t border-border pt-2 space-y-1.5">
          <Button size="sm" variant="outline" className="w-full text-xs"
            onClick={() => { onSkipToday(dateKey, activityId); onClose() }}>
            Skip just today
          </Button>
          <Button size="sm" variant="outline" className="w-full text-xs"
            onClick={() => { onSkipRange(dateKey, 'week', activityId); onClose() }}>
            Skip this week
          </Button>
          <Button size="sm" variant="outline" className="w-full text-xs"
            onClick={() => { onSkipRange(dateKey, 'future', activityId); onClose() }}>
            Skip all future days
          </Button>
        </div>
      </div>
    )
  }

  return (
    <p className="text-xs text-muted-foreground">
      {format(event.start, 'p')} – {format(event.end, 'p')} · {duration}m
    </p>
  )
}

// ─── EditCustomEventForm ──────────────────────────────────────────────────────

interface EditCustomEventFormProps {
  event: CalendarEvent
  onSave: (patch: Partial<CalendarEvent>) => void
  onDelete: () => void
}

function EditCustomEventForm({ event, onSave, onDelete }: EditCustomEventFormProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [startStr, setStartStr] = useState(format(event.start, "yyyy-MM-dd'T'HH:mm"))
  const [endStr, setEndStr] = useState(format(event.end, "yyyy-MM-dd'T'HH:mm"))
  const [location, setLocation] = useState(event.location ?? '')
  const [notes, setNotes] = useState(event.notes ?? '')
  const [priority, setPriority] = useState<Priority | ''>(event.priority ?? '')

  const duration = Math.round((event.end.getTime() - event.start.getTime()) / 60000)

  if (!editing) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {format(event.start, 'p')} – {format(event.end, 'p')} · {duration}m
        </p>
        {event.location && (
          <p className="text-xs text-muted-foreground">📍 {event.location}</p>
        )}
        {event.notes && (
          <p className="text-xs text-muted-foreground italic">"{event.notes}"</p>
        )}
        {event.priority && (
          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold
            ${event.priority === 'high' ? 'bg-red-500/15 text-red-400'
              : event.priority === 'medium' ? 'bg-amber-500/15 text-amber-400'
              : 'bg-green-500/15 text-green-400'}`}>
            {event.priority} priority
          </span>
        )}
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="flex-1 text-xs gap-1.5"
            onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />Edit
          </Button>
          <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium mb-1">Edit event</p>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-7 text-xs" />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Start</label>
        <Input type="datetime-local" value={startStr}
          onChange={(e) => setStartStr(e.target.value)} className="h-7 text-xs" />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">End</label>
        <Input type="datetime-local" value={endStr}
          onChange={(e) => setEndStr(e.target.value)} className="h-7 text-xs" />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Location</label>
        <Input value={location} onChange={(e) => setLocation(e.target.value)}
          placeholder="Optional" className="h-7 text-xs" />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Notes</label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional" className="h-7 text-xs" />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}
          className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs">
          <option value="">None</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div className="flex gap-1.5 pt-1">
        <Button size="sm" className="flex-1 h-7 text-xs"
          onClick={() => {
            onSave({
              title,
              start: new Date(startStr),
              end: new Date(endStr),
              location: location || undefined,
              notes: notes || undefined,
              priority: (priority as Priority) || undefined,
            })
          }}>
          Save
        </Button>
        <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs"
          onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ─── RetimeForm ───────────────────────────────────────────────────────────────

interface RetimeFormProps {
  initialStart: string
  initialDuration: number
  overridden: boolean
  onSave: (startTime: string, durationMinutes: number) => void
  onReset: () => void
}

function RetimeForm({ initialStart, initialDuration, overridden, onSave, onReset }: RetimeFormProps) {
  const [start, setStart] = useState(initialStart)
  const [duration, setDuration] = useState(initialDuration)
  return (
    <div className="space-y-1.5 rounded-md border border-border p-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium">Retime for this day</p>
        {overridden && (
          <span className="rounded bg-primary/15 px-1 py-0.5 text-[10px] text-primary">override</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-muted-foreground">Start</label>
        <Input type="time" value={start} onChange={(e) => setStart(e.target.value)}
          className="h-7 w-24 text-xs" />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-muted-foreground">Duration</label>
        <Input type="number" min={5} max={720} step={5} value={duration}
          onChange={(e) => setDuration(Number(e.target.value))} className="h-7 w-20 text-xs" />
        <span className="text-[10px] text-muted-foreground">min</span>
      </div>
      <div className="flex gap-1.5">
        <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => onSave(start, duration)}>
          Save
        </Button>
        {overridden && (
          <Button size="sm" variant="ghost" className="flex-1 h-7 text-xs" onClick={onReset}>
            Reset
          </Button>
        )}
      </div>
    </div>
  )
}
