# Cibaura — Web

Web frontend for **Cibaura**, a multi-vendor **rent-a-car marketplace**. One app serves two audiences:

- **Customers** — search cars by city + dates, browse agency storefronts, and request a booking.
- **Agencies** — a full dashboard: fleet, calendar & offline blocks, booking inbox (accept/reject), branches & delivery zones, wallet, and **staff management with granular permissions**.

> **Related repositories**
> - ⚙️ API / backend: [`cibaura-server`](https://github.com/angelrepublic24/cibaura-server) — domain model + wire contract live in its `docs/`.
> - 📱 Mobile app (Expo): [`cibaura-app`](https://github.com/angelrepublic24/cibaura-app)

## Stack

- **Next.js 15** (App Router, Turbopack) · **React 19** · **TypeScript**
- **TanStack Query** for server state · **Tailwind CSS 4** (OKLCH brand tokens) · shadcn/ui-style primitives
- Auth via httpOnly cookie; every agency surface is permission-gated with a `usePermission()` hook

## Getting started

```bash
# 1. Install
npm install

# 2. Environment
cp .env.example .env.local          # set NEXT_PUBLIC_API_URL (see below)

# 3. Run
npm run dev                         # http://localhost:3000  (needs the API running)
```

The backend must be running (default `http://localhost:4300`). See [`cibaura-server`](https://github.com/angelrepublic24/cibaura-server) for how to start it + seed demo data and logins.

## Environment variables

Every value is `NEXT_PUBLIC_*` and is **inlined into the browser bundle at build time**. Copy `.env.example` to `.env.local` for development; production builds fail loudly (`src/lib/config.ts`) when a required value is missing or wrong.

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | Base URL of the Cibaura API (e.g. `http://localhost:4300`; `/api` is appended automatically) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | yes (prod) | Stripe publishable key (`pk_test_…` / `pk_live_…`). Cards are tokenized by Stripe Elements; without it customers cannot save a card or book. A `pk_test_` key is refused in production unless `NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY=true` (staging) |
| `NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY` | no | `true` lets a staging production build ship a test key |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | no | Places autocomplete for door-to-door delivery addresses; without it address delivery is unavailable |
| `NEXT_PUBLIC_LEGAL_COMPANY_NAME` | no | Legal entity shown on `/legal/terms` + `/legal/privacy` (fallback `Cibaura`) |
| `NEXT_PUBLIC_LEGAL_RNC` | no | Dominican tax id; the RNC line is omitted when empty |
| `NEXT_PUBLIC_LEGAL_ADDRESS` | no | Registered address (fallback `Santo Domingo, Dominican Republic`) |
| `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL` | no | Legal/privacy contact (fallback `legal@cibaura.com`) |

The terms version and the cancellation-policy figures are **not** env vars: the web reads them from `GET /legal/current` and never hardcodes them.

### Deployment: same registrable domain as the API

The session rides in httpOnly **`SameSite=Lax`** cookies set by the API (ADR-0006). Browsers only attach those cookies to XHR/fetch when the web and the API share the same registrable domain (eTLD+1), e.g. `https://cibaura.com` + `https://api.cibaura.com`. A web on `*.vercel.app` talking to an API on `*.onrender.com` logs in "successfully" and then 401s on every request. There is deliberately no `rewrites()` proxy in `next.config.ts`; the API validates the domain pair at boot (`API_PUBLIC_URL` vs `FRONTEND_URL`), so deploy both under one domain.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Next dev server (Turbopack) |
| `npm run build` / `npm start` | production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

Node **22** (`.nvmrc`, `engines`). CI (`.github/workflows/ci.yml`) runs typecheck → lint → build on every push/PR.

## Structure

```
src/
  app/            App Router routes
    cars/[city]                        search results
    agencies/[slug]                    public agency storefront
    agencies/[slug]/cars/[carId]       agency-scoped car detail
    agency/…                           agency dashboard (fleet, calendar, requests,
                                       branches, zones, wallet, staff)
    account/…  admin/…  auth/…  legal/…
  features/       cars, agencies, agency, bookings, auth, payments, legal,
                  verification (api + components + hooks)
  shared/         ui primitives, auth store/guard, api client, brand <Logo>, types (wire mirror)
public/brand/     CIBAURA logo assets (isotype, wordmark, app icon, OG)
```

## Design

CIBAURA brand system: warm premium-minimalist — copper `#B8734E` as the accent, gold / olive / cream / navy as supporting tones, defined once as CSS variables in `src/app/globals.css`. The car is the hero; the UI stays quiet around it.
