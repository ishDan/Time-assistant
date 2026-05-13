import { Briefcase, MapPin } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { getCommuteMinutes } from '@/utils/commute'
import type { DayOfWeek } from '@/types'

const DAYS: { dow: DayOfWeek; short: string }[] = [
  { dow: 0, short: 'Su' },
  { dow: 1, short: 'Mo' },
  { dow: 2, short: 'Tu' },
  { dow: 3, short: 'We' },
  { dow: 4, short: 'Th' },
  { dow: 5, short: 'Fr' },
  { dow: 6, short: 'Sa' },
]

export function WorkStep() {
  const { settings, updateSettings } = useAppStore()
  const { work, locations, commuteMatrix, homeLocationId } = settings

  function toggleDay(dow: DayOfWeek) {
    const next = work.daysOfWeek.includes(dow)
      ? work.daysOfWeek.filter((d) => d !== dow)
      : ([...work.daysOfWeek, dow].sort() as DayOfWeek[])
    updateSettings({ work: { ...work, daysOfWeek: next } })
  }

  const commuteToWork = getCommuteMinutes(commuteMatrix, homeLocationId, work.locationId)

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Label
        </Label>
        <Input
          value={work.label}
          onChange={(e) => updateSettings({ work: { ...work, label: e.target.value } })}
          placeholder="Work, School, etc."
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Location
        </Label>
        <Select
          value={work.locationId}
          onValueChange={(v) => updateSettings({ work: { ...work, locationId: v } })}
        >
          <SelectTrigger>
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
        {work.locationId !== homeLocationId && (
          <p className="text-xs text-muted-foreground">
            Commute: {commuteToWork}m each way (set in Locations step).
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="work-start">Start time</Label>
          <Input
            id="work-start"
            type="time"
            value={work.startTime}
            onChange={(e) => updateSettings({ work: { ...work, startTime: e.target.value } })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="work-end">End time</Label>
          <Input
            id="work-end"
            type="time"
            value={work.endTime}
            onChange={(e) => updateSettings({ work: { ...work, endTime: e.target.value } })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Days of week</Label>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(({ dow, short }) => (
            <Button
              key={dow}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleDay(dow)}
              style={{ touchAction: 'manipulation' }}
              className={cn(
                'h-11 w-11 rounded-full p-0 text-xs font-medium transition-all',
                work.daysOfWeek.includes(dow)
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-muted text-muted-foreground border-border hover:bg-accent'
              )}
            >
              {short}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
