import { useMemo } from 'react'
import { format, startOfWeek, startOfMonth } from 'date-fns'
import { Trophy, Flame, Clock, TrendingUp, Star, Zap, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/store/useAppStore'
import { formatFreeTime } from '@/utils/freeTimeEngine'
import {
  calcCurrentStreak,
  calcLongestStreak,
  calcTotalProductiveHours,
  calcWeeklyProductiveMinutes,
  calcMonthlyProductiveMinutes,
} from '@/utils/recommendations'

interface Milestone {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  threshold: number
  unit: 'days' | 'hours' | 'streak'
}

const MILESTONES: Milestone[] = [
  { id: 'first', icon: <Star className="h-4 w-4" />, title: 'First Step', description: 'Log your first productive day', threshold: 1, unit: 'days' },
  { id: 'streak3', icon: <Flame className="h-4 w-4" />, title: 'On a Roll', description: '3-day productive streak', threshold: 3, unit: 'streak' },
  { id: 'streak7', icon: <Flame className="h-5 w-5" />, title: 'Week Warrior', description: '7-day productive streak', threshold: 7, unit: 'streak' },
  { id: 'streak30', icon: <Flame className="h-5 w-5" />, title: 'Unstoppable', description: '30-day streak', threshold: 30, unit: 'streak' },
  { id: 'hours10', icon: <Clock className="h-4 w-4" />, title: 'Getting Serious', description: '10 productive hours total', threshold: 10, unit: 'hours' },
  { id: 'hours50', icon: <Zap className="h-4 w-4" />, title: 'Power User', description: '50 productive hours total', threshold: 50, unit: 'hours' },
  { id: 'hours100', icon: <Trophy className="h-4 w-4" />, title: '100 Hours Club', description: '100 productive hours total', threshold: 100, unit: 'hours' },
  { id: 'hours500', icon: <Trophy className="h-5 w-5" />, title: 'Legend', description: '500 productive hours total', threshold: 500, unit: 'hours' },
  { id: 'days10', icon: <Target className="h-4 w-4" />, title: 'Habit Forming', description: '10 productive days logged', threshold: 10, unit: 'days' },
  { id: 'days30', icon: <TrendingUp className="h-4 w-4" />, title: 'Consistent', description: '30 productive days logged', threshold: 30, unit: 'days' },
]

function MilestoneCard({ milestone, achieved }: { milestone: Milestone; achieved: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 transition-colors
      ${achieved ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/20 opacity-50'}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-full
        ${achieved ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
        {milestone.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${achieved ? 'text-foreground' : 'text-muted-foreground'}`}>
          {milestone.title}
          {achieved && <span className="ml-2 text-primary text-xs">✓</span>}
        </p>
        <p className="text-xs text-muted-foreground">{milestone.description}</p>
      </div>
    </div>
  )
}

function StatCard({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="text-muted-foreground mt-0.5">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ProgressPage() {
  const { productivityLog, recommendations } = useAppStore()

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)

  const stats = useMemo(() => {
    const currentStreak = calcCurrentStreak(productivityLog)
    const longestStreak = calcLongestStreak(productivityLog)
    const totalHours = calcTotalProductiveHours(productivityLog)
    const totalDays = Object.keys(productivityLog).length
    const weeklyMinutes = calcWeeklyProductiveMinutes(productivityLog, weekStart)
    const monthlyMinutes = calcMonthlyProductiveMinutes(
      productivityLog,
      now.getFullYear(),
      now.getMonth() + 1
    )
    return { currentStreak, longestStreak, totalHours, totalDays, weeklyMinutes, monthlyMinutes }
  }, [productivityLog, weekStart, now])

  const recStats = useMemo(() => {
    const total = recommendations.length
    const accepted = recommendations.filter((r) => r.status === 'accepted').length
    const pending = recommendations.filter(
      (r) => r.status === 'pending' || r.status === 'maybe'
    ).length
    return { total, accepted, pending }
  }, [recommendations])

  const achievedMilestones = useMemo(() => {
    return MILESTONES.filter((m) => {
      if (m.unit === 'streak') return stats.longestStreak >= m.threshold
      if (m.unit === 'hours') return stats.totalHours >= m.threshold
      if (m.unit === 'days') return stats.totalDays >= m.threshold
      return false
    })
  }, [stats])

  const nextMilestone = useMemo(() => {
    return MILESTONES.find((m) => {
      if (m.unit === 'streak') return stats.longestStreak < m.threshold
      if (m.unit === 'hours') return stats.totalHours < m.threshold
      if (m.unit === 'days') return stats.totalDays < m.threshold
      return false
    })
  }, [stats])

  const nextProgress = useMemo(() => {
    if (!nextMilestone) return 100
    if (nextMilestone.unit === 'streak') return Math.min(100, (stats.longestStreak / nextMilestone.threshold) * 100)
    if (nextMilestone.unit === 'hours') return Math.min(100, (stats.totalHours / nextMilestone.threshold) * 100)
    if (nextMilestone.unit === 'days') return Math.min(100, (stats.totalDays / nextMilestone.threshold) * 100)
    return 0
  }, [nextMilestone, stats])

  const recentLog = useMemo(() => {
    return Object.entries(productivityLog)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 14)
  }, [productivityLog])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">My Progress</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track how well you're using your free time
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            icon={<Flame className="h-5 w-5" />}
            label="Current streak"
            value={`${stats.currentStreak}d`}
            sub={stats.currentStreak > 0 ? 'Keep it going!' : 'Start today'}
          />
          <StatCard
            icon={<Trophy className="h-5 w-5" />}
            label="Best streak"
            value={`${stats.longestStreak}d`}
            sub="Longest run"
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Total hours"
            value={`${stats.totalHours}h`}
            sub={`across ${stats.totalDays} days`}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="This week"
            value={formatFreeTime(stats.weeklyMinutes)}
            sub={`of ${format(weekStart, 'MMM d')} week`}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="This month"
            value={formatFreeTime(stats.monthlyMinutes)}
            sub={format(monthStart, 'MMMM yyyy')}
          />
          <StatCard
            icon={<Zap className="h-5 w-5" />}
            label="Suggestions"
            value={`${recStats.accepted}`}
            sub={`accepted · ${recStats.pending} pending`}
          />
        </div>

        {/* Next milestone */}
        {nextMilestone && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Next milestone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{nextMilestone.title}</p>
                  <p className="text-xs text-muted-foreground">{nextMilestone.description}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.round(nextProgress)}%
                </span>
              </div>
              <Progress value={nextProgress} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Achievements */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Achievements
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                {achievedMilestones.length} / {MILESTONES.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {MILESTONES.map((m) => (
              <MilestoneCard
                key={m.id}
                milestone={m}
                achieved={achievedMilestones.some((a) => a.id === m.id)}
              />
            ))}
          </CardContent>
        </Card>

        {/* Recent productive days */}
        {recentLog.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent Productive Days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1.5">
                {recentLog.map(([key, mins]) => (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <div
                      className="h-8 w-full rounded-sm bg-primary/20 flex items-end justify-center overflow-hidden"
                      title={`${format(new Date(key), 'MMM d')}: ${formatFreeTime(mins)}`}
                    >
                      <div
                        className="w-full bg-primary rounded-sm"
                        style={{ height: `${Math.min(100, (mins / 240) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(key + 'T12:00:00'), 'EEE')}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Last {recentLog.length} logged days · bar height = productive time
              </p>
            </CardContent>
          </Card>
        )}

        {recentLog.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="text-4xl mb-3">🎯</div>
              <p className="text-sm font-medium">No productive days logged yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Switch to Day view in Calendar and tap "Used My Spare Time Today" to start tracking.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
