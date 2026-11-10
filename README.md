# AJSJ Services LLC — Lead Tracker (V1)

Mobile-first lead, call-log and follow-up tracker. Next.js 15 · TypeScript · Tailwind · Supabase · PWA.

---

## 1. Set up Supabase (≈5 minutes)

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. **Authentication → Sign In / Providers → Email**: keep Email enabled, and turn **off "Allow new users to sign up"**. Only people you add can get in.
4. **Authentication → Users → Add user → Create new user** for yourself (and anyone else): email + password, tick **Auto Confirm User**.
5. Set your display name: **Table Editor → profiles** → edit `full_name` (shows on call logs and "Assigned to").
6. **Project Settings → API**: copy the Project URL and the `anon` public key.

## 2. Run locally

```bash
cp .env.example .env.local     # paste the URL + anon key
npm install
npm run dev                    # http://localhost:3000
```

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project** → import the repo (framework auto-detects Next.js).
3. Add environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_TIMEZONE` (`America/New_York`).
4. Deploy.

## 4. Put it on your iPhone home screen

Open the Vercel URL in **Safari** → Share → **Add to Home Screen**. It opens full-screen with the AJSJ icon, like a native app. Sign in once inside the home-screen app (it keeps its own login separate from Safari).

---

## How it works

| Screen | What it does |
|---|---|
| **Home** | Today's follow-ups, overdue, new (never-contacted) leads, calls logged today, "Calls for Today" list (overdue first), recent activity |
| **Leads** | Search (company, name, phone — digits or formatted — email, notes); quick filters (Overdue, Due Today, Not Contacted, Contacted, Added This Week); more filters for status, company, follow-up window, sort |
| **Follow-Ups** | Due / Overdue / Today / Upcoming / Done tabs |
| **Add Lead** | All lead fields + optional first follow-up |
| **Lead detail** | Call · Email · Log Call · Add Note · Schedule Follow-Up · Edit, then the full activity timeline |

**Log Call** stamps date, time and user automatically. Tap an outcome, optionally add notes, a follow-up shortcut (Tomorrow / 2 Days / 3 Days / 1 Week / 2 Weeks / Custom) and a new status, then save. Saving:

- updates Last Contacted and the "last outcome" line on the lead card
- adds the call to the timeline
- changes status if one was picked (the app pre-selects a suggested status when the outcome moves the lead forward, e.g. *Spoke With Contact* → *Contacted*; tap **Keep** to skip it)
- marks today's/overdue follow-ups done, and schedules the new one if chosen

**Follow-up rules:** each lead has one "next follow-up". Shortcut buttons land at **9:00 AM** on that day (change `FOLLOW_UP_DEFAULT_HOUR` in `src/lib/options.ts`). "Overdue" means the scheduled *date* has passed. Scheduling a new follow-up replaces the old one; the Follow Up sheet also has **Mark done** and **Clear**.

---

## Customizing

- **Logo** — `public/ajsj-logo.png` (white, used on the navy header/login) and `public/ajsj-logo-black.png` (dark, for light backgrounds). Replace either file to update it. If a file is missing the app shows "AJSJ Services LLC" text instead. App icons are in `public/icons/` and `public/apple-touch-icon.png`.
- **Statuses** — edit rows in the `lead_statuses` table: rename `label`, reorder with `sort_order`, hide with `is_active = false`, pick a badge `color` (blue, slate, gray, cyan, amber, emerald, violet, orange, teal, green, stone, red). Status suggestions after a call only move a lead *forward* by `sort_order`.
- **Lead sources** — edit rows in `lead_sources` the same way.
- **Call outcomes** — `CALL_OUTCOMES` in `src/lib/options.ts`.

## Project layout

```
supabase/schema.sql        tables, triggers, RPCs (log_call, schedule_follow_up, close_follow_ups), RLS
public/                    logos, icons, service worker, offline page
src/app/(app)/             signed-in screens: home, leads, leads/[id], leads/[id]/edit, leads/new, follow-ups
src/app/login/             sign-in screen
src/app/actions.ts         all server actions (writes)
src/components/            LeadCard, LogCallSheet, FollowUpSheet, NoteSheet, LeadForm, Timeline, Nav, Logo…
src/lib/                   Supabase clients, types, time-zone date helpers, options
```

## Access model (V1)

Everyone who can sign in is on the same team and sees all leads. `assigned_to`, `created_by` and a `profiles.role` column are already in place, so per-user views or admin-only settings can be added later without reshaping data.

## Ready for later (not built in V1)

Sales/revenue analytics: add tables such as `opportunities (lead_id, amount, stage, won_at…)` that reference `leads.id`. Every call and status change is already stored in `activities` with timestamps, so conversion and call-volume reports can be built from existing history.
