import { useState } from 'react'
import { Plus, Trash2, Clock, Sparkles, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppStore } from '@/store/useAppStore'
import { buildFreeTimeSummary, formatFreeTime } from '@/utils/freeTimeEngine'
import type { Endeavor, Priority } from '@/types'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

const TIME_OF_DAY_LABELS: Record<Endeavor['preferredTimeOfDay'], string> = {
  morning: '🌅 Morning',
  afternoon: '☀️ Afternoon',
  evening: '🌙 Evening',
  any: '⏰ Any time',
}

export function PlannerPage() {
  const { endeavors, addEndeavor, removeEndeavor, settings } = useAppStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Omit<Endeavor, 'id' | 'createdAt'>>({
    name: '',
    description: '',
    estimatedMinutes: 60,
    preferredTimeOfDay: 'any',
    color: COLORS[0]!,
    // Priority is optional — undefined = neutral (no ranking boost)
  })

  const summary = buildFreeTimeSummary(settings)

  function handleAdd() {
    if (!form.name.trim()) return
    addEndeavor({
      ...form,
      id: `endeavor-${Date.now()}`,
      createdAt: new Date().toISOString(),
    })
    setOpen(false)
    setForm({ name: '', description: '', estimatedMinutes: 60, preferredTimeOfDay: 'any', color: COLORS[0]! })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 md:mb-8 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold">Planner</h1>
          <p className="mt-1 text-xs md:text-sm text-muted-foreground">
            Your hobbies & side hustles — we'll find the best slots for them.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 shrink-0" size="sm">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Endeavor</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Free time banner */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">
              You have <span className="text-primary font-bold">{formatFreeTime(summary.weekFreeMinutes)}</span> free this week
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.yearRemainingFreeHours}h remaining before year-end — plenty for your goals!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Endeavors grid */}
      {endeavors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No endeavors yet</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            Add a hobby, side hustle, or project — and we'll show you when you can work on it.
          </p>
          <Button onClick={() => setOpen(true)} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Add your first endeavor
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {endeavors.map((endeavor) => {
            const sessions = Math.floor((summary.yearRemainingFreeHours * 60) / endeavor.estimatedMinutes)
            return (
              <Card key={endeavor.id} className="group relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full w-1"
                  style={{ backgroundColor: endeavor.color }}
                />
                <CardHeader className="pb-2 pl-5">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{endeavor.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeEndeavor(endeavor.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  {endeavor.description && (
                    <CardDescription className="text-xs">{endeavor.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pl-5 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      {formatFreeTime(endeavor.estimatedMinutes)} / session
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {TIME_OF_DAY_LABELS[endeavor.preferredTimeOfDay]}
                    </Badge>
                    {endeavor.locationId && endeavor.locationId !== settings.homeLocationId && (() => {
                      const loc = settings.locations.find((l) => l.id === endeavor.locationId)
                      return loc ? (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <MapPin className="h-3 w-3" />
                          {loc.icon} {loc.name}
                        </Badge>
                      ) : null
                    })()}
                    {endeavor.priority && (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          endeavor.priority === 'high'
                            ? 'border-red-400 text-red-400'
                            : endeavor.priority === 'medium'
                            ? 'border-amber-400 text-amber-400'
                            : 'border-green-400 text-green-400'
                        }`}
                      >
                        {endeavor.priority}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You could fit <span className="font-semibold text-foreground">{sessions} sessions</span> before year-end
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add endeavor dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Endeavor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Podcast, Photography, Coding side project"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="A short note..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Session length (min)</Label>
                <Input
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  value={form.estimatedMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedMinutes: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Preferred time</Label>
                <Select
                  value={form.preferredTimeOfDay}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, preferredTimeOfDay: v as Endeavor['preferredTimeOfDay'] }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">🌅 Morning</SelectItem>
                    <SelectItem value="afternoon">☀️ Afternoon</SelectItem>
                    <SelectItem value="evening">🌙 Evening</SelectItem>
                    <SelectItem value="any">⏰ Any time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Priority <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select
                value={form.priority ?? 'none'}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    priority: v === 'none' ? undefined : (v as Priority),
                  }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">⚪ None — neutral ranking</SelectItem>
                  <SelectItem value="high">🔴 High — suggest first</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="low">🟢 Low — suggest when there's room</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Location <span className="text-muted-foreground font-normal">(optional — triggers commute on accept)</span></Label>
              <Select
                value={form.locationId ?? 'none'}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, locationId: v === 'none' ? undefined : v }))
                }
              >
                <SelectTrigger><SelectValue placeholder="Same as home / no commute" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">🏠 Home / no commute</SelectItem>
                  {settings.locations
                    .filter((loc) => loc.id !== settings.homeLocationId)
                    .map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.icon} {loc.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    className={`h-7 w-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110' : 'opacity-70 hover:opacity-100'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!form.name.trim()}>Add Endeavor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
