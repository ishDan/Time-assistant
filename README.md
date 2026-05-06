# Time Assistant

**A smart personal scheduling app that shows you exactly how much free time you have — and helps you use it.**

🔗 **[Live Demo → time-assistant.vercel.app](https://time-assistant.vercel.app/)**

---

## What It Does

Most people feel busy without knowing where their time actually goes. Time Assistant builds your daily schedule from the ground up — sleep, work, commutes, meals, routines — and surfaces the windows of free time you didn't know you had.

You can then set goals (called *Endeavors*), and the app intelligently suggests when to work on them based on your real availability.

---

## Features

- **Smart Calendar** — Week/day/agenda views built on React Big Calendar with drag-and-drop rescheduling. Events auto-split at midnight and render with distinct color coding per type (sleep, work, commute, buffer, suggestions).
- **Automatic Schedule Generation** — Recurring events (sleep, work, fixed blocks) are generated 12 weeks ahead from a single settings configuration. Per-day overrides let you skip or retime any activity without touching the template.
- **Free Time Engine** — Calculates today's free minutes, this week's free hours, and remaining free hours for the year, updating live as your schedule changes.
- **Endeavors / Goal Planner** — Add long-term goals with estimated time requirements. The recommendation engine chunks them into realistic sessions and slots them into your actual free windows.
- **AI-Style Recommendations** — Suggestions avoid past-time slots, respect your wake/sleep boundaries, round-robin across goals so nothing gets ignored, and track progress through cycles.
- **Commute Awareness** — Define locations and travel times. The scheduler automatically inserts commute legs between activities at different locations.
- **Duplicate Events** — Copy any event (sleep, work, custom) to a new date/time in one click.
- **Onboarding Wizard** — New users are guided through sleep schedule, work hours, locations, and fixed routines before seeing their first calendar.
- **Dark/Light Theme** — Full dark mode support with Tailwind CSS.
- **Persistent State** — All settings and events survive page refreshes via Zustand + localStorage (versioned with migrations).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| State | Zustand with `persist` middleware |
| Calendar | React Big Calendar + drag-and-drop addon |
| Styling | Tailwind CSS + shadcn/ui components |
| Date logic | date-fns |
| Routing | React Router v7 |
| Deployment | Vercel |

---

## Running Locally

```bash
git clone https://github.com/ishDan/Time-assistant.git
cd Time-assistant
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Project Structure

```
src/
├── pages/          # CalendarPage, PlannerPage, SettingsPage, ProgressPage
├── components/     # UI components, onboarding wizard, calendar event renderer
├── store/          # Zustand store with all app state and actions
├── utils/          # Schedule engine, free-time calculator, recommendation engine
└── types/          # Shared TypeScript interfaces
```

---

## Key Engineering Decisions

- **Single store, no backend** — All state lives in Zustand with versioned migrations, making the app fully client-side and instantly deployable with zero infrastructure.
- **Schedule-as-computation** — Rather than storing recurring events in a database, the schedule is computed on-the-fly from a settings object, meaning a single settings change propagates across all 12 weeks instantly.
- **Midnight-split segments** — Overnight events (sleep, late-night activities) are automatically split into two calendar segments so each day column renders correctly without layout bugs.
- **Circular import prevention** — The recommendation engine defines its own local types rather than importing from the store, avoiding a circular dependency that caused blank-page failures.
