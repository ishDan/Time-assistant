import { Moon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/store/useAppStore'

export function SleepStep() {
  const { settings, updateSettings } = useAppStore()
  const { sleep } = settings

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-primary" />
            Hours of sleep per night
          </Label>
          <span className="text-lg font-bold text-primary">{sleep.hoursPerNight}h</span>
        </div>
        <Slider
          min={4}
          max={12}
          step={0.5}
          value={[sleep.hoursPerNight]}
          onValueChange={([v]) =>
            updateSettings({ sleep: { ...sleep, hoursPerNight: v ?? 8 } })
          }
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>4h</span>
          <span className="text-center">Recommended: 7–9h</span>
          <span>12h</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bedtime">Typical bedtime</Label>
        <Input
          id="bedtime"
          type="time"
          value={sleep.bedtime}
          onChange={(e) =>
            updateSettings({ sleep: { ...sleep, bedtime: e.target.value } })
          }
          className="w-40"
        />
      </div>

      <div className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary">
        You'll get approximately <strong>{sleep.hoursPerNight}h</strong> of sleep, leaving{' '}
        <strong>{Math.round((24 - sleep.hoursPerNight) * 10) / 10}h</strong> of waking time daily.
      </div>
    </div>
  )
}
