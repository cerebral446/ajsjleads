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

## Builder Discovery

Apply [supabase/discovery.sql](supabase/discovery.sql) to the **existing** Supabase project after `schema.sql`. It adds discovery tables, row-level permissions, transaction-safe review, run history and a CRM source. Existing leads, contacts and activities stay in their current tables. The original team access model applies. Discovery is available from the signed-in navigation.

### Production scheduler

1. Set the server-only `SUPABASE_SERVICE_ROLE_KEY` and a random `CRON_SECRET` (32 random bytes or more) in Vercel Production. Keep the current public Supabase settings. Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
2. Review publisher terms and permissions. If permitted, enable `DISCOVERY_NEFBA_DIRECTORY_ALLOWED=true` and independently `DISCOVERY_NEFBA_PINNACLE_ALLOWED=true`. The defaults leave those sources in manual-import mode. Check the configured authorized feeds in the same way. Set `DISCOVERY_RADIUS_MILES` if the default 75 miles needs changing.
3. Deploy to the existing Vercel production project on a plan that permits four daily cron invocations (for example, Pro). Vercel reads `vercel.json` and invokes the worker at 00:00, 06:00, 12:00 and 18:00 UTC, passing `CRON_SECRET` in the Authorization header. Verify the cron registration in Vercel. Use only one scheduler for the deployment.
4. From Discovery, run a manual search and inspect each source result. A manual run does not verify the schedule. Verify a **scheduled** row in Discovery after the next UTC window. The dashboard displays timestamps in Eastern time and flags the scheduler after seven hours without a scheduled run.

The worker records a durable run before processing. A unique active lease prevents concurrent ingestion. The database suppresses duplicate scheduled executions in the same UTC window and marks abandoned leases failed on the next invocation. Source connection errors and 5xx responses get one bounded retry. The crawler observes robots rules, a minimum ten-second per-host request interval and bounded request/response sizes. It stops on redirects, access restrictions and publisher throttling and surfaces an import path. Run history distinguishes source errors, manual-required sources and successful source reads. Raw NEFBA source totals count category listings. Category breakdowns can include the same candidate in more than one category.

### Windows

Use Node.js 22+ and PowerShell in the repository directory.

```powershell
Copy-Item .env.example .env.local
npm ci
npm test
npm run build
npm start
```

Fill in `.env.local` before the build and apply the Supabase migration. Keep the production Next.js process running on the Windows host if it is serving the application. Open `http://localhost:3000/discovery` and sign in.

For a Windows deployment without Vercel cron, verify the worker from PowerShell first.

```powershell
node --env-file=.env.local scripts/run-discovery-cron.mjs
```

Register it with Task Scheduler for a deployment whose app process is already kept running. This task reads the secret from the same environment file, so restrict access to that file and the task account. Use absolute paths.

```powershell
$repo = (Get-Location).Path
$node = (Get-Command node).Source
$arguments = '--env-file="{0}\.env.local" "{0}\scripts\run-discovery-cron.mjs"' -f $repo
$action = New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours 6)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'AJSJ Builder Discovery' -Action $action -Trigger $trigger -Settings $settings
```

For unattended Windows hosting, configure the task to run whether its service account is signed in and keep the machine awake and connected. Use `DISCOVERY_APP_URL` in the file if the app uses a different origin. Confirm recurring execution in Task Scheduler and Discovery run history.

### Research sources and review

Discovery checks the five NEFBA categories first, then the Pinnacle program, then any authorized JSON feeds. Add the permitted feed URLs to `DISCOVERY_AUTHORIZED_FEEDS` to run scheduled corroboration from builder websites, associations, business listings or permitting providers for which you have a compatible feed. Third-party sites without a compatible feed can be cross-checked by a reviewer and recorded through **Import authorized research**. If robots rules, terms or access prevent retrieval, use a publisher-provided export or manually record evidence where authorized. The current Pinnacle program page provides program context. Only explicitly named proof published by NEFBA qualifies as a verified Pinnacle observation.

Feeds and imports use the same JSON array format. Each row requires `name`, `sourceType`, `sourceUrl` and `checkedAt`. Supported types are `NEFBA`, `Builder website`, `Builders association`, `Business listing`, `Permitting` and `Authorized research`. The import accepts up to 500 observations. Only set confirmation fields if the cited source supports the exact value and identifies the same business. Include the same normalized business name and a corroborated phone, address or domain when supplementing an existing record.

```json
[
  {
    "name": "Example Builder LLC",
    "legalName": "Example Builder LLC",
    "sourceType": "Builder website",
    "sourceUrl": "https://example.com/about",
    "checkedAt": "2026-11-18",
    "classification": "builder",
    "classificationEvidence": "The company describes itself as a licensed custom home builder.",
    "phone": "904-555-0101",
    "phoneConfirmed": true,
    "website": "https://example.com/",
    "domainConfirmed": true,
    "city": "Jacksonville",
    "state": "FL",
    "zip": "32202",
    "scope": "The published project portfolio identifies stucco exteriors."
  }
]
```

Optional fields include `category`, `email`, `address`, numeric `latitude` and `longitude` from the cited source, `contact` plus `role` and `contactConfirmed: true`, `construction` with a `constructionDate` (YYYY-MM-DD), `onboarding` URL, `sizeEvidence`, and `pinnacleEvidence`. For Pinnacle, cite the NEFBA program page with a named confirmation. A directory category or company name alone does not establish contractor classification. Use `developer`, `non-builder` or `uncertain` with supporting evidence where appropriate.

Distance uses sourced coordinates when present, then ZIP centroids. Locations near the radius boundary or without enough evidence go to research. Score points are visible in the evidence panel. Size is scored only with supporting evidence and is independent of vendor onboarding. The 16 initial names are inserted as unchecked leads for discovery review. An authorized team member approves a confirmed regional builder with a public phone into the existing pipeline. Approval links an existing high-confidence CRM match instead of duplicating it. Possible matches can be compared before approving a separate company. Existing CRM contact records, sales statuses, notes and activities are never rewritten by discovery. Approval does not initiate outreach.

### Verification

Run `npm test` for regional filtering, source parsing, evidence validation, the PostgreSQL migration, deduplication, approval idempotency and CRM preservation. Run `npm run typecheck` and `npm run build` before deploying.
