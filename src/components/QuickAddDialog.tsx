import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Location, Priority } from '@/types'

export interface QuickAddDraft {
  start: Date
  end: Date
  snapped: boolean
  noFreeSlot?: boolean
  /** Prefill fields (used by "Duplicate event") */
  title?: string
  locationId?: string
  notes?: string
  priority?: Priority
  /** Changes dialog title + primary button label */
  mode?: 'new' | 'duplicate'
}

export interface QuickAddSubmit {
  title: string
  start: Date
  end: Date
  locationId?: string
  notes?: string
  priority: Priority
}

interface Props {
  open: boolean
  draft: QuickAddDraft | null
  locations: Location[]
  homeLocationId: string
  onCancel: () => void
  onSubmit: (value: QuickAddSubmit) => void
}

function toTimeInput(d: Date): string {
  return format(d, 'HH:mm')
}

function toDateInput(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function applyDate(dateStr: string, timeStr: string): Date {
  const [y, mo, day] = dateStr.split('-').map(Number)
  const [h, mi] = timeStr.split(':').map(Number)
  const d = new Date()
  d.setFullYear(y ?? d.getFullYear(), (mo ?? 1) - 1, day ?? 1)
  d.setHours(h ?? 0, mi ?? 0, 0, 0)
  return d
}

export function QuickAddDialog({
  open,
  draft,
  locations,
  homeLocationId,
  onCancel,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [duration, setDuration] = useState(60)
  const [locationId, setLocationId] = useState<string>(homeLocationId)
  const [notes, setNotes] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')

  useEffect(() => {
    if (!draft) return
    setTitle(draft.title ?? '')
    setDateStr(toDateInput(draft.start))
    setStartTime(toTimeInput(draft.start))
    const mins = Math.max(
      15,
      Math.round((draft.end.getTime() - draft.start.getTime()) / 60_000)
    )
    setDuration(mins)
    setLocationId(draft.locationId ?? homeLocationId)
    setNotes(draft.notes ?? '')
    setPriority(draft.priority ?? 'medium')
  }, [draft, homeLocationId])

  if (!draft) return null

  const isDuplicate = draft.mode === 'duplicate'

  const handleSave = () => {
    if (!title.trim()) return
    const start = applyDate(dateStr, startTime)
    const end = new Date(start.getTime() + duration * 60_000)
    onSubmit({
      title: title.trim(),
      start,
      end,
      locationId,
      notes: notes.trim() || undefined,
      priority,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isDuplicate ? 'Duplicate Event' : 'New Event'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {draft.snapped && !draft.noFreeSlot && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-300">
              Snapped to nearest free slot to avoid conflicts with your schedule.
            </div>
          )}
          {draft.noFreeSlot && (
            <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
              This day has no free slots — the event will overlap existing items.
            </div>
          )}

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              autoFocus
              placeholder="What are you adding?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Start</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Input
                type="number"
                min={15}
                max={720}
                step={15}
                value={duration}
                onChange={(e) => setDuration(Math.max(15, Number(e.target.value)))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.icon} {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">🔴 High</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Optional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim()}>
            {isDuplicate ? 'Add Copy' : 'Add Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
