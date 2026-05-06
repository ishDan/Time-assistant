# Project: FreeSlot — Smart Time Discovery Calendar

## Goal
Build a beautiful, modern React web app that helps users **discover hidden pockets of free time** in their busy schedule for hobbies, passions, and side hustles. It feels like Google Calendar but is smarter: it learns routines, calculates realistic free time (including projections to Dec 31), and encourages progress with badges.

## Core Philosophy
- Most people think they have “no time.” This app proves them wrong by showing **real gaps** after accounting for sleep, work, family, commute, eating, chores, etc.
- Focus on **positive encouragement** — never guilt.

## Tech Stack (must use)
- React 18+ (Vite + TypeScript)
- Tailwind CSS + shadcn/ui (for premium, accessible components)
- react-big-calendar (for the main Google-Calendar-style view — month/week/day/agenda + drag-and-drop)
- date-fns (for all date/time math)
- lucide-react (icons)
- Zustand or React Context + localStorage (for state & persistence — no backend yet)
- Responsive, dark/light mode support

## Key Features (implement in this order)

### 1. Onboarding / Settings Page (first screen users see)
- Preferred sleep hours (auto-suggest based on age)
- Work / school hours (with days-of-week selector)
- Family / relationship time (daily or weekly target)
- Passive / fixed blocks users can toggle:
  - Commute
  - Eating (breakfast, lunch, dinner)
  - Bathroom / personal care (average daily)
  - Laundry / chores
  - Gardening / yard work
  - Working out / exercise
- “Time-sensitive tasks” section: users can add activities that can only happen in certain windows (e.g., cold calls before 9 PM)

### 2. Smart Free-Time Engine
- Calculates **daily/weekly free minutes** after subtracting all fixed blocks.
- Projects total free hours/days remaining until **December 31** of the current year.
- Shows friendly estimates: “You have ~4.2 hours this week” or “Enough for 3 × 90-minute hobby sessions before year-end.”

### 3. Main Calendar View (Google-Calendar style)
- Full react-big-calendar integration (month, week, day, agenda views)
- Pre-populated recurring events from user settings (work, school, sleep, etc.)
- Color-coded blocks:
  - Fixed (gray)
  - Free / suggested hobby slots (green)
  - User-added events (blue)
- Right sidebar: quick “Add to free slot” button (movies, going out, appointments, etc.)

### 4. Hobby / Side-Hustle Planner
- Users can create “endeavors” (hobby or side hustle) with:
  - Name, estimated time needed, preferred time of day
  - Time-sensitive rules (e.g., “only evenings”)
- App auto-suggests the best free slots for each endeavor

### 5. Reminders & Notifications
- Browser notifications for suggested free slots
- Gentle daily/weekly summary: “You have 2.5 free hours tomorrow — perfect for your podcast project!”

### 6. Progress & Motivation (future-phase)
- Simple badge/achievement system (e.g., “First 5-hour week”, “Side Hustle Starter”)
- Progress streaks and shareable stats (ready for future community feature)

## UI/UX Requirements (very important — you care about quality)
- Clean, calm, modern design (think Notion + Google Calendar + linear.app)
- Excellent mobile responsiveness
- Smooth animations and transitions
- Dark mode by default
- Polished forms, cards, and modals using shadcn/ui
- Intuitive drag-and-drop on calendar

## Data Model (simple)
- UserSettings (sleep, work, family, fixed blocks, etc.)
- RecurringEvents
- CustomEvents
- Endeavors (hobbies/side hustles)
- All stored in localStorage + Zustand

## Instructions for Claude
1. First, **plan the folder structure and component architecture** (show me the plan).
2. Then implement **step by step**, one feature at a time, with clear diffs.
3. Use best practices: TypeScript everywhere, clean code, reusable components.
4. After each major feature, ask if I want to test it or move to the next.
5. Make the UI feel premium and motivating.

Start building now!