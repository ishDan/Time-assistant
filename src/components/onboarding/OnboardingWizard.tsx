import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Briefcase, Heart, Wrench, MapPin, ArrowRight, ArrowLeft, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/store/useAppStore'
import { SleepStep } from './SleepStep'
import { WorkStep } from './WorkStep'
import { FamilyStep } from './FamilyStep'
import { FixedBlocksStep } from './FixedBlocksStep'
import { LocationsStep } from './LocationsStep'

const STEPS = [
  { id: 'sleep', title: 'Sleep', description: 'How much do you sleep?', icon: Clock },
  { id: 'locations', title: 'Locations', description: 'Where you spend time + travel time between them', icon: MapPin },
  { id: 'work', title: 'Work / School', description: 'Your schedule', icon: Briefcase },
  { id: 'family', title: 'Family & Social', description: 'Time for people you care about', icon: Heart },
  { id: 'blocks', title: 'Daily Habits', description: 'Fixed activities, pinned to locations', icon: Wrench },
]

export function OnboardingWizard() {
  const [step, setStep] = useState(0)
  const completeOnboarding = useAppStore((s) => s.completeOnboarding)
  const navigate = useNavigate()

  const isLast = step === STEPS.length - 1

  function handleNext() {
    if (isLast) {
      completeOnboarding()
      navigate('/')
    } else {
      setStep((s) => s + 1)
    }
  }

  const current = STEPS[step]!

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl animate-fade-in">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
              <Clock className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Welcome to FreeSlot</h1>
          <p className="mt-2 text-muted-foreground">
            Let's discover how much time you actually have. It'll only take 2 minutes.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-primary' : i < step ? 'w-4 bg-primary/40' : 'w-4 bg-border'
              }`}
            />
          ))}
        </div>

        <Card className="border-border shadow-xl">
          <CardContent className="p-8">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  {current.icon && <current.icon className="h-5 w-5 text-primary" />}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{current.title}</h2>
                  <p className="text-sm text-muted-foreground">{current.description}</p>
                </div>
              </div>
            </div>

            <div className="min-h-[200px]">
              {step === 0 && <SleepStep />}
              {step === 1 && <LocationsStep />}
              {step === 2 && <WorkStep />}
              {step === 3 && <FamilyStep />}
              {step === 4 && <FixedBlocksStep />}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setStep((s) => s - 1)}
                disabled={step === 0}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext} className="gap-2">
                {isLast ? (
                  <>
                    <Check className="h-4 w-4" />
                    Let's go!
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          You can always change these in Settings
        </p>
      </div>
    </div>
  )
}
