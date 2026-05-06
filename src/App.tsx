import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { AppShell } from '@/components/layout/AppShell'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { CalendarPage } from '@/pages/CalendarPage'
import { PlannerPage } from '@/pages/PlannerPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ProgressPage } from '@/pages/ProgressPage'

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(theme)
  }, [theme])

  return <>{children}</>
}

export default function App() {
  const onboardingComplete = useAppStore((s) => s.settings.onboardingComplete)

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {!onboardingComplete ? (
            <Route path="*" element={<OnboardingWizard />} />
          ) : (
            <Route element={<AppShell />}>
              <Route index element={<CalendarPage />} />
              <Route path="planner" element={<PlannerPage />} />
              <Route path="progress" element={<ProgressPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          )}
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
