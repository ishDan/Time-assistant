import { useState } from 'react'
import { Plus, Trash2, MapPin, Home as HomeIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useAppStore } from '@/store/useAppStore'
import { getCommuteMinutes, allLocationPairs, canonicalKey } from '@/utils/commute'
import { LOCATION_ICON_OPTIONS } from '@/types'

export function LocationsStep() {
  const {
    settings,
    addLocation,
    updateLocation,
    removeLocation,
    setCommute,
    setEndDayAtHome,
  } = useAppStore()
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📍')

  const { locations, commuteMatrix, homeLocationId, endDayAtHome } = settings
  const homeLoc = locations.find((l) => l.id === homeLocationId)
  const otherLocations = locations.filter((l) => l.id !== homeLocationId)

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    addLocation(name, newIcon)
    setNewName('')
    setNewIcon('📍')
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Tell us where you spend time. Enter one total duration between each pair of places —
        we'll auto-generate directional commute legs in both directions.
      </p>

      {/* Home (always present) */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-2">
          <HomeIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Home</span>
          <span className="text-xs text-muted-foreground">· your base, always included</span>
        </div>
        {homeLoc && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg">{homeLoc.icon}</span>
            <Input
              className="h-8 text-sm flex-1"
              value={homeLoc.name}
              onChange={(e) => updateLocation(homeLoc.id, { name: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* Other locations */}
      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {otherLocations.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-1">
            No other locations yet — add one below.
          </p>
        )}
        {otherLocations.map((loc) => (
          <div key={loc.id} className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  className="h-8 w-8 rounded-md border border-border hover:bg-accent text-lg flex items-center justify-center"
                  onClick={() => {
                    const idx = LOCATION_ICON_OPTIONS.indexOf(loc.icon)
                    const next =
                      LOCATION_ICON_OPTIONS[(idx + 1) % LOCATION_ICON_OPTIONS.length]!
                    updateLocation(loc.id, { icon: next })
                  }}
                  title="Click to cycle icon"
                  type="button"
                >
                  {loc.icon}
                </button>
              </div>
              <Input
                className="h-8 text-sm flex-1"
                value={loc.name}
                onChange={(e) => updateLocation(loc.id, { name: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => removeLocation(loc.id)}
                aria-label="Remove location"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Commute from Home to this location */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {homeLoc?.icon} {homeLoc?.name} ↔ {loc.icon} {loc.name}
                </span>
                <span className="font-medium text-foreground">
                  {getCommuteMinutes(commuteMatrix, homeLocationId, loc.id)}m
                </span>
              </div>
              <Slider
                min={0}
                max={120}
                step={5}
                value={[getCommuteMinutes(commuteMatrix, homeLocationId, loc.id)]}
                onValueChange={([v]) => setCommute(homeLocationId, loc.id, v ?? 0)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Inter-location matrix (non-home pairs only) */}
      {otherLocations.length >= 2 && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3 w-3" />
            Between other locations
          </Label>
          <div className="space-y-2">
            {allLocationPairs(otherLocations).map(({ a, b }) => {
              const locA = locations.find((l) => l.id === a)!
              const locB = locations.find((l) => l.id === b)!
              return (
                <div key={canonicalKey(a, b)} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {locA.icon} {locA.name} ↔ {locB.icon} {locB.name}
                    </span>
                    <span className="font-medium text-foreground">
                      {getCommuteMinutes(commuteMatrix, a, b)}m
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={120}
                    step={5}
                    value={[getCommuteMinutes(commuteMatrix, a, b)]}
                    onValueChange={([v]) => setCommute(a, b, v ?? 0)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add new */}
      <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
        <Label className="text-xs text-muted-foreground">Add a new location</Label>
        <div className="flex gap-2">
          <button
            className="h-9 w-9 rounded-md border border-border hover:bg-accent text-lg flex items-center justify-center shrink-0"
            onClick={() => {
              const idx = LOCATION_ICON_OPTIONS.indexOf(newIcon)
              const next =
                LOCATION_ICON_OPTIONS[(idx + 1) % LOCATION_ICON_OPTIONS.length]!
              setNewIcon(next)
            }}
            type="button"
            title="Cycle icon"
          >
            {newIcon}
          </button>
          <Input
            className="h-9 text-sm flex-1"
            placeholder="e.g. Gym, School, Parents' House"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button size="sm" onClick={handleAdd} disabled={!newName.trim()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {/* End of day */}
      <div className="rounded-lg border border-border p-3 flex items-center justify-between">
        <div>
          <Label htmlFor="end-home" className="cursor-pointer text-sm">
            End each day at Home
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Auto-adds a commute back home after your last activity.
          </p>
        </div>
        <Switch
          id="end-home"
          checked={endDayAtHome}
          onCheckedChange={setEndDayAtHome}
        />
      </div>
    </div>
  )
}
