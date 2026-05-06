import { Heart } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { useAppStore } from '@/store/useAppStore'

export function FamilyStep() {
  const { settings, updateSettings } = useAppStore()
  const mins = settings.familyMinutesPerDay

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            Family & relationship time
          </Label>
          <span className="text-lg font-bold text-primary">{mins}m / day</span>
        </div>
        <Slider
          min={0}
          max={300}
          step={15}
          value={[mins]}
          onValueChange={([v]) => updateSettings({ familyMinutesPerDay: v ?? 60 })}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>None</span>
          <span>5h</span>
        </div>
      </div>

      <div className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary">
        {mins === 0
          ? 'No family time blocked — you can always add it later.'
          : `${mins} minutes per day reserved for the people who matter most. 💙`}
      </div>
    </div>
  )
}
