import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileTopBar } from './MobileTopBar'

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileTopBar />
        <main
          className="flex-1 overflow-y-auto bg-white dark:bg-black p-4 md:p-8 pb-20 md:pb-8"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
        >
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
