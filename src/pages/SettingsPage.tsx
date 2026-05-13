import { SleepStep } from '@/components/onboarding/SleepStep'
import { WorkStep } from '@/components/onboarding/WorkStep'
import { FamilyStep } from '@/components/onboarding/FamilyStep'
import { FixedBlocksStep } from '@/components/onboarding/FixedBlocksStep'
import { LocationsStep } from '@/components/onboarding/LocationsStep'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Settings</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">
          Adjust your schedule — the free-time engine updates instantly.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Sleep</CardTitle></CardHeader>
        <CardContent><SleepStep /></CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader><CardTitle className="text-base">Locations & Commute</CardTitle></CardHeader>
        <CardContent><LocationsStep /></CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader><CardTitle className="text-base">Work / School</CardTitle></CardHeader>
        <CardContent><WorkStep /></CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader><CardTitle className="text-base">Family & Social</CardTitle></CardHeader>
        <CardContent><FamilyStep /></CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader><CardTitle className="text-base">Daily Habits</CardTitle></CardHeader>
        <CardContent><FixedBlocksStep /></CardContent>
      </Card>
    </div>
  )
}
