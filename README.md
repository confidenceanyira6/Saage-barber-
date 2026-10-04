# Saage Barber

Mobile-first React + Vite + TypeScript app for the Saage barber marketplace (Supabase project `krhvfpblabfchrolhgve`). Orange, black and white theme with automatic light/dark mode.

```bash
npm install
npm run dev
```

The public Supabase URL and anon key are built in; set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` to override. Never put service-role or payment secret keys in this repo.

## Built
Splash, welcome, login/register with role choice (customer, male barber, female hairstylist), search with filters, barber profile and services, time selection (from the barber's real availability), review and confirm, booking confirmation, My Bookings (pay, confirm service, cancel; barbers accept/reject), wallet/earnings with add money and withdrawal, notifications, identity verification, VIP subscription, logout.

## Not built yet
In-app chat, tips, leaving reviews, edit profile and service management, availability editor, portfolio, social feed, saved barbers, help/settings pages, multi-language.

Bookings are requests: the barber accepts, then the customer pays (held in escrow until both confirm).
