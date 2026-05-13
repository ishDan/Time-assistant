import { Clock } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { buildFreeTimeSummary, formatFreeTime } from '@/utils/freeTimeEngine'
import { ThemeToggle } from './ThemeToggle'

export function MobileTopBar() {
  const settings = useAppStore((s) => s.settings)
  const summary = buildFreeTimeSummary(settings)

  return (
    <header
      className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-background/95 backdrop-blur px-4 py-2"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Clock className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold">Time Assistant</span>
          <span className="text-[10px] text-muted-foreground">
            {formatFreeTime(summary.todayFreeMinutes)} free today
          </span>
        </div>
      </div>
      <ThemeToggle />
    </header>
  )
}
