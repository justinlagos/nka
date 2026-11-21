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
| API | `src/app/api/v1`, `src/app/api/mcp`, `src/lib/api` | The studio for other software: five services run end to end, the rest file a brief for the team |
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

## API

The same studio with a door for agents and platforms. Docs for callers are at `/developers`; the machine-readable versions are `/api/v1` (catalogue) and `/api/v1/openapi.json`. MCP clients connect to `/api/mcp`.

- **Five groups** (`GROUPS` in `src/lib/api/types.ts`): Brand and identity, Documents and decks, Social and campaign, Motion, Events. The plan is for all 23 services in them to run automated. A service is live once its pipeline is built and tested; until then it is on request.
- **Live services** (`src/lib/api/endpoints`): brand guidelines, brand audit, colour and type system, logo file pack, naming and taglines, logo design, brand check, documents and decks, social templates, e-cards. Each is one file with its input schema, an example and a `run` function. The schema validates requests and also fills the OpenAPI document, the MCP tool list and the docs page, so they can't drift.
- **On request** (`ON_REQUEST` in `src/lib/api/catalogue.ts`): the 13 not built yet. `POST /api/v1/requests` files a draft brief in the caller's workspace; a person sends it, so software never commits plan hours or a price.
- **Moving a service from on request to live**: add an endpoint file, add it to `ENDPOINTS`, add a route folder under `src/app/api/v1`, remove it from `ON_REQUEST`, add tests.
- **Access**: off by default. Switch it on per client and set monthly credits on the client's admin page. Clients make keys on `/app/developers`. Keys are stored as hashes and shown once.
- **Jobs** (`src/lib/api/server.ts`): every request is a row in `api_jobs`. The database function `api_begin_job` checks the key, the per-minute rate and the monthly credits and records the job in one step. Failed jobs cost nothing.
- **What is never made up**: quote totals, contrast, tints and type scales are computed. Where Claude organises or writes text, output containing a figure the caller didn't supply is discarded. Results carry a `notes` list saying what was skipped.
- **SVG from callers and from the model** (`src/lib/api/svg.ts`, `cleanShapes` in `logo-design.ts`): only a short list of drawing elements and attributes is kept, so no script, event handler or outside link reaches a file we hand back. Logo marks from the model arrive as numbers and colour tokens, never as markup.
- **Files callers point us at** (`src/lib/api/fetch.ts`): fetched with private and metadata addresses blocked, by name and by DNS, on every redirect hop.

Needs in Vercel: `SUPABASE_SECRET_KEY` (all API calls), `NEXT_PUBLIC_SITE_URL` (links in results), `ANTHROPIC_API_KEY` (image and copy checks, voice principles, organising raw notes, writing posts from a topic; everything else runs without it). Apply migration `0015_api.sql`.

Not built yet: the 13 on-request services, card billing for API use (credits are capped per client by hand for now), PDF output (documents are print-ready HTML), and PNG output for social templates (SVG only).

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

- `npm test`: budget maths, brief layout, plan mapping, formatting, and the API (schemas, colour maths, quote totals, layouts, SVG cleaning, logo packs, key and webhook signing, address checks, MCP).
- `tests/db/api.sql` (39 checks: keys, who can read what, rate limit, credits, idempotency, revoking, card opens).
- `tests/db/trust.sql` (20 checks: lead designer, resizes, pause, payouts, invites) and `tests/db/demo.sql` (9 checks: demo setup).
- `tests/db/workflow.sql`: 33 checks of roles, invites, estimates, Flex budget, versions, review, plan caps and the queue, leads, and isolation between clients. Runs in one transaction and rolls back.
- `npm run build`

## Before taking real clients

- Confirm each client in `src/content/work.ts` is happy to be named.
- Confirm the timings in `src/lib/plans.ts` and `src/content/services.ts`.
- Have the terms and privacy notice reviewed, and add a contact email.
