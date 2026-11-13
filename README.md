# Nka

The monthly design studio from MotionPlay Labs. *Nka* is Igbo for art, craft and skill.

Clients subscribe to a plan (or a Flex budget), send briefs, approve estimates, review files with pinned comments, and keep approved work in a library. The studio works the queue from an admin side.

## What's here

| Area | Path | What it does |
|---|---|---|
| Public site | `src/app/(site)` | Home, services (8 pages), work, how it works, pricing (no public prices), about, terms, privacy |
| Book a demo | `src/app/(site)/demo` | Four questions, then an email code. Builds the client's workspace (brand basics, named designer, first brief drafted) before the call |
| Sign in | `src/app/signin`, `src/app/auth` | Email code that works on any device, plus a link (Supabase Auth) |
| Client workspace | `src/app/app` | Home, projects, brief assistant, brief editor, project page with review, library, brand book, billing, team, invites |
| Studio admin | `src/app/admin` | Queue by lane, clients with plan and Flex budget controls, call requests |
| Stripe webhook | `src/app/api/stripe/webhook` | Keeps each organisation's plan in step with Stripe |
| Support chat | `src/components/SupportChat.tsx`, `src/app/api/support/chat`, `src/app/api/custard` | Abigail, the AI support assistant in the client workspace (Custard AI). Read only |
| Support record | `src/app/admin/support` | Chat summaries and support cases from Abigail |
| Database | `supabase/migrations` | Tables, row-level security and workflow functions |

Plans, prices and limits live in `src/lib/plans.ts` only. Services, work and FAQs live in `src/content`.

## Automation

- **Website to brand book** (`src/lib/brand-scan.ts`, `brand-sync.ts`): reads logo, colours, fonts, what they do and their tone from a client's site. Runs in the demo and from the brand book page.
- **Talk-to-brief** (`src/components/BriefChat.tsx`): one line or a voice note, at most two tap-to-answer questions, then the brief is written.
- **Two ways to send**: Instant (AI makes three options in about a minute, monthly cap per plan in `instant_limit`) or Designer.
- **Instant date** (`src/lib/automation.ts`): every designer brief is sized when sent; the client sees an expected date, the studio's estimate is pre-filled, and paid-up plan clients start automatically.
- **Early directions**: three AI concept images on designer briefs while the designer starts.
- **Emails**: the client hears when work starts, when an estimate or file is ready, and gets a reminder after two days; the studio gets client decisions and a weekday list of late work (`/api/cron/daily`).

Needs in Vercel: `OPENAI_API_KEY` (images; model in `IMAGE_MODEL`, default `gpt-image-2`), `RESEND_API_KEY` and `NKA_NOTIFY_EMAIL` (emails), `CRON_SECRET` (reminders). Optional `STUDIO_HOURLY_RATE` pre-fills estimate amounts for non-plan clients.

## Support chat (Abigail, on Custard AI)

A **Help** button in the client workspace opens a chat with Abigail, an AI assistant hosted by Custard AI (custardai.dev). She can check the client's plan, team hours, Instant briefs, projects, agreed dates and files waiting for review, and explain how Nka works. She can't change anything.

How it's kept safe:

- **Nka's server does all the talking to Custard.** The browser sends only the message text to `/api/support/chat`. The server reads who is signed in and which organisation they're in from the Supabase session. The Custard API key never reaches a browser.
- **Signed client ids.** Abigail knows each client as `nka1.<user>.<org>.<signature>` (`src/lib/custard-sign.ts`). Only Nka can make one (`CUSTARD_IDENTITY_SECRET`), so a lookup for a made-up id returns nothing.
- **Lookups check membership every time.** `/api/custard/lookup` needs the lookup secret. It then calls `support_lookup` (migration 0015), which checks the person is still in that organisation and returns only what they already see in their workspace: designers by alias, no versions still in Nka's internal review, no payment details.
- **Conversations stay with their owner.** A conversation id from the browser is only carried on if it belongs to that person in that organisation.
- **Daily cap.** 60 messages per person per UK day (`SUPPORT_DAILY_CAP` in `src/lib/custard.ts`), so a runaway chat can't spend the Custard credit.
- **No changes.** Custard "action" requests are always refused.
- **Transcripts stay in Custard.** Nka keeps the summary and case details (`support_events`). Anything that needs a person is emailed to `NKA_NOTIFY_EMAIL` and listed in `/admin/support`.

The owner can also ask John (Custard's cofounder assistant) for numbers. These go to the same lookup address as `event: "metrics"`:
- `customers`, `projects` and `mrr` (plan income at list prices) come from the database. Workspaces marked internal don't count.
- `revenue` and `transactions` come from Stripe payments, less refunds.

### Switching it on

1. Apply `supabase/migrations/0015_support.sql`.
2. In Vercel, set:
   - `CUSTARD_API_KEY`: Custard > Account > Developers > Show API key.
   - `CUSTARD_STAFF_ID`: Abigail's staff ID, from the same page.
   - `CUSTARD_LOOKUP_SECRET`: a long random string. The same value also goes into Custard (step 3).
   - `CUSTARD_IDENTITY_SECRET`: another long random string. This one never leaves Vercel. Changing it later makes Abigail treat every client as new.
   - `CUSTARD_SIGNING_SECRET`: from Custard, after step 3.
   - `SUPABASE_SECRET_KEY`, if it isn't set already.
3. In Custard > Account > Developers:
   - **Live lookup:** link `https://<your-domain>/api/custard/lookup`, secret = `CUSTARD_LOOKUP_SECRET`.
   - **Webhook:** link `https://<your-domain>/api/custard/webhook`. Tap Connect, then copy the signing secret into `CUSTARD_SIGNING_SECRET`.
4. In Custard > Staff > Abigail:
   - Turn on **Live lookups**. Leave **Live changes** off.
   - Turn on **Website chat**; the API only answers while it's on. Leave its list of web addresses empty, because Nka's own chat doesn't use Custard's widget.
5. Redeploy. The Help button appears once `CUSTARD_API_KEY`, `CUSTARD_STAFF_ID`, `CUSTARD_IDENTITY_SECRET` and `SUPABASE_SECRET_KEY` are all set.

Before real clients use it: have Custard AI's data processing agreement in place, and name Custard AI in the privacy notice as a service that processes support chats.

## Promises the product enforces

Each answers a common complaint about design subscriptions (see `PROMISES` in `src/content/site.ts`):

- **One named designer** per client (`orgs.lead_id`). Changing them needs a written handover note the client sees.
- **Fixed prices.** An approved estimate can't be changed.
- **Free resizes.** Clients ask from the library; it starts at once and doesn't use a request slot.
- **Dates you can check.** Each project shows the agreed date and whether first files arrived on time; the client home shows the on-time record.
- **Leave or pause any month.** Pause stops Stripe collection for up to a month; new briefs queue meanwhile.
- **Unused Flex budget is yours.** It carries over 12 months; staff record a payout when a client leaves.

## How the work flows

1. A client writes a request. With `ANTHROPIC_API_KEY` set, Claude drafts a full brief from it and the brand book; without it, the request is laid out with the missing details as questions. Nothing is invented either way.
2. The client edits and sends it. On a plan, if their active requests are full it's **queued** and starts automatically when one finishes.
3. The studio sends an estimate. Plan clients go straight into production; Flex and one-off clients need an owner or admin to approve it, and Flex approval takes the amount off the budget.
4. The studio uploads files. Same title = new version. The client pins comments on images, approves or asks for changes.
5. When every file is reviewed, the project is completed and approved files appear in the library.

All status changes run through database functions that check who is asking, so a browser can't set a status, a price or a plan.

## Setup

1. `cp .env.example .env.local` and fill in the values.
2. `npm install`
3. Apply `supabase/migrations/*.sql` in order (already applied to the Nka Supabase project).
4. Add studio staff: `insert into staff_emails values ('you@example.com');` before they first sign in.
5. `npm run dev`

### Going live

- **Supabase** > Authentication > Emails: paste the templates in `supabase/email-templates.md` into "Magic link" and "Confirm signup". They add the sign-in code and a link that works on any device.
- **Contact details**: set `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_CONTACT_PHONE` in Vercel. Blank values are hidden.
- **Plans**: prices aren't shown publicly. After the demo call, send the client `https://<your-domain>/app/billing?plan=growth` (or `starter`, `studio`) to start that plan by card.

- **Supabase** > Authentication > URL configuration: set Site URL to the live address and add `https://<your-domain>/auth/callback` to redirect URLs. Set up custom SMTP (Resend works) so sign-in emails aren't rate-limited.
- **Stripe**: add `STRIPE_SECRET_KEY`. The three plan prices are created automatically on the first checkout (lookup keys `nka_*_monthly_gbp`). Save the Customer portal settings once in the Dashboard. Add a webhook to `https://<your-domain>/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.created`, `.updated`, `.deleted`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`. The webhook also needs `SUPABASE_SECRET_KEY`.

## Checks

- `npm test`: budget maths, brief layout, plan mapping, formatting, and the support chat's signed ids, webhook signatures, UK periods and answers.
- `tests/db/trust.sql` (20 checks: lead designer, resizes, pause, payouts, invites) and `tests/db/demo.sql` (9 checks: demo setup).
- `tests/db/support.sql` (26 checks: lookups only for members, no other client's projects, aliases not names, no internal versions, daily cap, conversations bound to their owner, nothing callable from a browser).
- `tests/db/workflow.sql`: 33 checks of roles, invites, estimates, Flex budget, versions, review, plan caps and the queue, leads, and isolation between clients. Runs in one transaction and rolls back.
- `npm run build`

## Before taking real clients

- Confirm each client in `src/content/work.ts` is happy to be named.
- Confirm the timings in `src/lib/plans.ts` and `src/content/services.ts`.
- Have the terms and privacy notice reviewed, and add a contact email.
