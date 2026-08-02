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

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the Cibaura API (e.g. `http://localhost:4300/api`) |

> Validation is fail-loud: a missing `NEXT_PUBLIC_API_URL` stops the build on purpose.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Next dev server (Turbopack) |
| `npm run build` / `npm start` | production build / serve |
| `npm run lint` | ESLint |

## Structure

```
src/
  app/            App Router routes
    cars/[city]                        search results
    agencies/[slug]                    public agency storefront
    agencies/[slug]/cars/[carId]       agency-scoped car detail
    agency/…                           agency dashboard (fleet, calendar, requests,
                                       branches, zones, wallet, staff)
    account/…  admin/…  auth/…
  features/       cars, agencies, agency, bookings, auth, payments (api + components + hooks)
  shared/         ui primitives, auth store/guard, api client, brand <Logo>, types (wire mirror)
public/brand/     CIBAURA logo assets (isotype, wordmark, app icon, OG)
```

## Design

CIBAURA brand system: warm premium-minimalist — copper `#B8734E` as the accent, gold / olive / cream / navy as supporting tones, defined once as CSS variables in `src/app/globals.css`. The car is the hero; the UI stays quiet around it.
