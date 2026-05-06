import { useState } from 'react'
import { format } from 'date-fns'
import { RotateCcw, MoreHorizontal, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store/useAppStore'
import {
  dateKey,
  isActivityActive,
  isScheduledByDefault,
  resolvedBufferMinutes,
} from '@/utils/daySchedule'
import type { DayOfWeek } from '@/types'
import { WORK_ACTIVITY_ID } from '@/types'

interface Props {
  date: Date
}

interface Row {
  id: string
  title: string
  scheduledByDefault: boolean
  supportsBuffer: boolean
}

export function DayFlowPanel({ date }: Props) {
  const {
    settings,
    setDayOverride,
    clearDayOverride,
    clearAllDayOverrides,
    setRangeOverride,
    setBufferMinutes,
    setBufferOverride,
    clearBufferOverride,
  } = useAppStore()
  const dow = date.getDay() as DayOfWeek
  const key = dateKey(date)
  const hasOverrides =
    Boolean(settings.dayOverrides[key]) || Boolean(settings.bufferOverrides[key])
  const [openRangeFor, setOpenRangeFor] = useState<string | null>(null)

  const rows: Row[] = [
    {
      id: 'sleep',
      title: `😴 Sleep (${settings.sleep.bedtime} · ${settings.sleep.hoursPerNight}h)`,
      scheduledByDefault: true,
      supportsBuffer: true,
    },
    {
      id: WORK_ACTIVITY_ID,
      title: `💼 ${settings.work.label}`,
      scheduledByDefault: settings.work.daysOfWeek.includes(dow),
      supportsBuffer: true,
    },
    ...settings.fixedBlocks
      .filter((b) => b.enabled)
      .map((b) => ({
        id: b.id,
        title: b.label,
        scheduledByDefault: b.daysOfWeek ? b.daysOfWeek.includes(dow) : true,
        supportsBuffer: true,
      })),
    ...settings.timeSensitiveTasks.map((t) => ({
      id: t.id,
      title: t.name,
      scheduledByDefault: t.daysOfWeek.includes(dow),
      supportsBuffer: true,
    })),
  ]

  function handleToggle(row: Row, next: boolean) {
    if (next === row.scheduledByDefault) {
      clearDayOverride(key, row.id)
    } else {
      setDayOverride(key, row.id, next)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {format(date, 'EEE, MMM d')}
        </p>
        {hasOverrides && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => {
              clearAllDayOverrides(key)
              rows.forEach((r) => clearBufferOverride(key, r.id))
            }}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      <div className="rounded-md border border-border px-2.5 py-2 space-y-1">
        <label className="text-[11px] text-muted-foreground">
          Default buffer between activities
        </label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={60}
            value={settings.bufferMinutes}
            onChange={(e) => setBufferMinutes(Number(e.target.value))}
            className="h-7 w-16 text-xs"
          />
          <span className="text-[11px] text-muted-foreground">minutes</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {rows.map((row) => {
          const active = isActivityActive(settings, row.id, date)
          const defaultActive = isScheduledByDefault(settings, row.id, dow)
          const overridden = active !== defaultActive
          const bufferMins = resolvedBufferMinutes(settings, date, row.id)
          const bufferOverridden =
            settings.bufferOverrides[key]?.[row.id] !== undefined
          const isOpen = openRangeFor === row.id

          return (
            <div
              key={row.id}
              className="rounded-md border border-border px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1 truncate text-xs">
                  <span className={active ? '' : 'text-muted-foreground line-through'}>
                    {row.title}
                  </span>
                  {overridden && (
                    <span className="ml-1.5 rounded bg-primary/15 px-1 py-0.5 text-[10px] text-primary">
                      override
                    </span>
                  )}
                </div>
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setOpenRangeFor(isOpen ? null : row.id)}
                  aria-label="More"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
                <Switch
                  checked={active}
                  onCheckedChange={(v) => handleToggle(row, v)}
                />
              </div>

              {isOpen && (
                <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px]"
                      onClick={() => {
                        setRangeOverride(key, 'week', row.id, false)
                        setOpenRangeFor(null)
                      }}
                    >
                      Skip this week
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px]"
                      onClick={() => {
                        setRangeOverride(key, 'future', row.id, false)
                        setOpenRangeFor(null)
                      }}
                    >
                      Skip all future
                    </Button>
                  </div>
                  {row.supportsBuffer && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-muted-foreground">
                        Buffer before:
                      </label>
                      <Input
                        type="number"
                        min={0}
                        max={60}
                        value={bufferMins}
                        onChange={(e) =>
                          setBufferOverride(key, row.id, Number(e.target.value))
                        }
                        className="h-6 w-14 text-[10px]"
                      />
                      <span className="text-[10px] text-muted-foreground">m</span>
                      {bufferOverridden && (
                        <button
                          onClick={() => clearBufferOverride(key, row.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Reset buffer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
