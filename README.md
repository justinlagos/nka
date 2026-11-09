# Nka

The monthly design studio from MotionPlay Labs. *Nka* is Igbo for art, craft and skill.

Clients subscribe to a plan (or a Flex budget), send briefs, approve estimates, review files with pinned comments, and keep approved work in a library. The studio works the queue from an admin side.

## What's here

| Area | Path | What it does |
|---|---|---|
| Public site | `src/app/(site)` | Home, services (8 pages), work, how it works, pricing, about, book a call, terms, privacy |
| Sign in | `src/app/signin`, `src/app/auth` | Passwordless email link (Supabase Auth) |
| Client workspace | `src/app/app` | Home, projects, brief assistant, brief editor, project page with review, library, brand book, billing, team, invites |
| Studio admin | `src/app/admin` | Queue by lane, clients with plan and Flex budget controls, call requests |
| Stripe webhook | `src/app/api/stripe/webhook` | Keeps each organisation's plan in step with Stripe |
| Database | `supabase/migrations` | Tables, row-level security and workflow functions |

Plans, prices and limits live in `src/lib/plans.ts` only. Services, work and FAQs live in `src/content`.

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

- **Supabase** > Authentication > URL configuration: set Site URL to the live address and add `https://<your-domain>/auth/callback` to redirect URLs. Set up custom SMTP (Resend works) so sign-in emails aren't rate-limited.
- **Stripe**: add `STRIPE_SECRET_KEY`. The three plan prices are created automatically on the first checkout (lookup keys `nka_*_monthly_gbp`). Save the Customer portal settings once in the Dashboard. Add a webhook to `https://<your-domain>/api/stripe/webhook` for `checkout.session.completed` and `customer.subscription.created`, `.updated`, `.deleted`, and put its signing secret in `STRIPE_WEBHOOK_SECRET`. The webhook also needs `SUPABASE_SECRET_KEY`.

## Checks

- `npm test`: budget maths, brief layout, plan mapping, formatting.
- `tests/db/workflow.sql`: 33 checks of roles, invites, estimates, Flex budget, versions, review, plan caps and the queue, leads, and isolation between clients. Runs in one transaction and rolls back.
- `npm run build`

## Before taking real clients

- Confirm each client in `src/content/work.ts` is happy to be named.
- Confirm the timings in `src/lib/plans.ts` and `src/content/services.ts`.
- Have the terms and privacy notice reviewed, and add a contact email.
