import { NavLink } from 'react-router-dom'
import { CalendarDays, Sparkles, Settings, Clock, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { buildFreeTimeSummary, formatFreeTime } from '@/utils/freeTimeEngine'
import { ThemeToggle } from './ThemeToggle'

const navItems = [
  { to: '/', icon: CalendarDays, label: 'Calendar' },
  { to: '/planner', icon: Sparkles, label: 'Planner' },
  { to: '/progress', icon: TrendingUp, label: 'Progress' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const settings = useAppStore((s) => s.settings)
  const summary = buildFreeTimeSummary(settings)

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Clock className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-sidebar-foreground">FreeSlot</span>
      </div>

      {/* Free-time summary widget */}
      <div className="mb-6 rounded-xl border border-sidebar-border bg-sidebar-accent p-4">
        <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Today's free time</p>
        <p className="text-2xl font-bold text-primary">{formatFreeTime(summary.todayFreeMinutes)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatFreeTime(summary.weekFreeMinutes)} this week
        </p>
        <div className="mt-3 border-t border-sidebar-border pt-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-sidebar-foreground">{summary.yearRemainingFreeHours}h</span> free before Dec 31
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ≈ {summary.sessionsUntilYearEnd(90)} × 90-min sessions
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex items-center justify-between px-2">
        <p className="text-xs text-muted-foreground">v0.1.0</p>
        <ThemeToggle />
      </div>
    </aside>
  )
}
