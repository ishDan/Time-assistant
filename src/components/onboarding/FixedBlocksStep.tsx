import { useState } from 'react'
import { Plus, Trash2, MapPin } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store/useAppStore'
import { getCommuteMinutes } from '@/utils/commute'
import type { TimingMode, FixedBlock, ActivityPreset, DayOfWeek } from '@/types'
import { ACTIVITY_PRESETS } from '@/types'

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 1, label: 'Mo' },
  { value: 2, label: 'Tu' },
  { value: 3, label: 'We' },
  { value: 4, label: 'Th' },
  { value: 5, label: 'Fr' },
  { value: 6, label: 'Sa' },
  { value: 0, label: 'Su' },
]
const EVERY_DAY: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6]

function toggleDay(days: DayOfWeek[], d: DayOfWeek): DayOfWeek[] {
  return days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort()
}

const TIMING_OPTIONS: { value: TimingMode; label: string }[] = [
  { value: 'before-work', label: 'Before work' },
  { value: 'after-work', label: 'After work' },
  { value: 'morning', label: 'Morning' },
  { value: 'midday', label: 'Midday' },
  { value: 'evening', label: 'Evening' },
  { value: 'custom', label: 'Custom time' },
]

function needsCustomTime(mode: TimingMode): boolean {
  return mode === 'morning' || mode === 'midday' || mode === 'evening' || mode === 'custom'
}

function defaultTimeFor(mode: TimingMode): string {
  if (mode === 'morning') return '07:30'
  if (mode === 'midday') return '12:30'
  if (mode === 'evening') return '18:30'
  return '12:00'
}

export function FixedBlocksStep() {
  const {
    settings,
    toggleFixedBlock,
    updateFixedBlock,
    addFixedBlockFromPreset,
    removeFixedBlock,
  } = useAppStore()
  const [newPreset, setNewPreset] = useState<ActivityPreset>('exercise')
  const { locations, commuteMatrix, homeLocationId, work } = settings

  function handleTimingChange(block: FixedBlock, nextMode: TimingMode) {
    const patch: Partial<FixedBlock> = { timingMode: nextMode }
    if (needsCustomTime(nextMode)) {
      patch.customStartTime = block.customStartTime ?? defaultTimeFor(nextMode)
    }
    updateFixedBlock(block.id, patch)
  }

  function handlePresetChange(block: FixedBlock, preset: ActivityPreset) {
    const def = ACTIVITY_PRESETS.find((p) => p.value === preset)
    if (!def) return
    updateFixedBlock(block.id, {
      activityPreset: preset,
      icon: def.icon,
      label: `${def.icon} ${def.label}`,
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Daily activities. Each one happens at a location — commute is inserted automatically.
      </p>

      <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
        {settings.fixedBlocks.map((block) => {
          const isAtHome = block.locationId === homeLocationId
          const commuteFromHome = getCommuteMinutes(commuteMatrix, homeLocationId, block.locationId)
          const commuteFromWork = getCommuteMinutes(commuteMatrix, work.locationId, block.locationId)

          return (
            <div key={block.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <Select
                    value={block.activityPreset}
                    onValueChange={(v) => handlePresetChange(block, v as ActivityPreset)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_PRESETS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.icon} {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Switch
                  checked={block.enabled}
                  onCheckedChange={() => toggleFixedBlock(block.id)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeFixedBlock(block.id)}
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {block.activityPreset === 'custom' && (
                <Input
                  className="mt-2 h-8 text-sm"
                  placeholder="Activity name (e.g. 'Guitar lesson')"
                  value={block.label.replace(/^[^\s]+\s/, '')}
                  onChange={(e) =>
                    updateFixedBlock(block.id, { label: `✨ ${e.target.value}` })
                  }
                />
              )}

              {block.enabled && (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Duration</span>
                      <span className="font-medium text-foreground">
                        {block.minutesPerDay >= 60
                          ? `${Math.floor(block.minutesPerDay / 60)}h ${block.minutesPerDay % 60 ? `${block.minutesPerDay % 60}m` : ''}`.trim()
                          : `${block.minutesPerDay}m`}
                      </span>
                    </div>
                    <Slider
                      min={5}
                      max={720}
                      step={5}
                      value={[block.minutesPerDay]}
                      onValueChange={([v]) => updateFixedBlock(block.id, { minutesPerDay: v ?? 30 })}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={5}
                        max={720}
                        step={5}
                        value={block.minutesPerDay}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          if (!Number.isNaN(n)) {
                            updateFixedBlock(block.id, {
                              minutesPerDay: Math.max(5, Math.min(720, n)),
                            })
                          }
                        }}
                        className="h-7 w-20 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">minutes (max 720 = 12h)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Location
                      </Label>
                      <Select
                        value={block.locationId}
                        onValueChange={(v) => updateFixedBlock(block.id, { locationId: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.icon} {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">When</Label>
                      <Select
                        value={block.timingMode}
                        onValueChange={(v) => handleTimingChange(block, v as TimingMode)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMING_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {needsCustomTime(block.timingMode) && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Start time</Label>
                      <Input
                        type="time"
                        className="h-8 w-32 text-xs"
                        value={block.customStartTime ?? defaultTimeFor(block.timingMode)}
                        onChange={(e) =>
                          updateFixedBlock(block.id, { customStartTime: e.target.value })
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Days of week</Label>
                    <div className="flex flex-wrap gap-1">
                      {DAYS_OF_WEEK.map((d) => {
                        const days = block.daysOfWeek ?? EVERY_DAY
                        const on = days.includes(d.value)
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() =>
                              updateFixedBlock(block.id, {
                                daysOfWeek: toggleDay(days, d.value),
                              })
                            }
                            style={{ touchAction: 'manipulation' }}
                            className={`h-10 w-10 rounded-md border text-xs font-medium transition ${
                              on
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
                            }`}
                          >
                            {d.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {!isAtHome && (
                    <p className="text-xs text-muted-foreground italic">
                      {block.timingMode === 'after-work' && work.locationId !== block.locationId
                        ? `After work → ${locations.find((l) => l.id === block.locationId)?.name}: ${commuteFromWork}m commute inserted automatically.`
                        : `Home → ${locations.find((l) => l.id === block.locationId)?.name}: ${commuteFromHome}m. Commute inserted based on where you come from.`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-dashed border-border p-3">
        <Label className="text-xs text-muted-foreground">Add another activity</Label>
        <div className="mt-1.5 flex gap-2">
          <Select value={newPreset} onValueChange={(v) => setNewPreset(v as ActivityPreset)}>
            <SelectTrigger className="h-9 flex-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_PRESETS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => addFixedBlockFromPreset(newPreset)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}
