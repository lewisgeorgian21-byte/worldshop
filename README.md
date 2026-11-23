# World Market

World Market is a Georgian-first, responsive marketplace MVP built with Next.js, TypeScript, SQLite, Prisma and Stripe Connect. It includes a real catalog backed by SQLite, account registration and login, seller listings, favorites, order history APIs, seller payment onboarding, and a webhook-confirmed single-item checkout flow. It does not claim that a payment succeeded until Stripe verifies it. This is a working foundation, not yet the complete production marketplace described in the original product brief.

## Requirements

- Node.js 20+
- No database server required; SQLite is stored locally in `prisma/dev.db`
- Stripe account with Connect enabled for seller transfers

## Local setup

1. Copy `.env.example` to `.env` if it does not already exist. The default `DATABASE_URL` uses local SQLite.
2. Install dependencies: `npm install`
3. Generate the Prisma client and create/update the SQLite schema: `npm run db:generate` and `npm run db:push`
4. Seed the Georgian/English category catalog and sample listings: `npm run db:seed`
5. Start the app: `npm run dev`

The homepage is at `http://localhost:3000`. New users register from the sign-in dialog. To bootstrap a development super-admin, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in the environment before running the seed command. No default credentials or fake listings are seeded.

Listing photos can be uploaded as JPEG, PNG, or WebP files (up to 5 MB each, 8 per listing) and are stored under `public/uploads`. This local storage persists on disk with the project; back up that directory along with the SQLite database. The image URL field remains available as an optional fallback.

## Payments

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, a Stripe-supported `STRIPE_CONNECT_COUNTRY`, and `PLATFORM_COMMISSION_PERCENT` to use Stripe Checkout. Sellers can start hosted Stripe Express onboarding from the listing form. Run Stripe's local webhook forwarder against `/api/webhooks/stripe` during development. Listing prices are whole GEL; order amount/commission values are stored in tetri (minor units). Checkout creates a pending order; the signed Stripe webhook is the only path that marks an order paid and the listing sold.

Stripe Connect destination charges require a Stripe account and merchant model eligible for the selected country, account type, and payment method. Confirm local legal and provider requirements before taking live payments. TBC and Bank of Georgia gateway credentials/adapters are not included; do not enable a gateway until its official merchant integration and signed callback handling are implemented and tested.

## Production checklist

- The local setup uses SQLite. For deployment, use durable persistent storage for `prisma/dev.db` and automated backups, or migrate to a managed database before launch.
- Configure HTTPS, production database settings, a production Stripe restricted key, and webhook signing secret in the hosting provider's secret manager.
- Add email verification, password recovery, MFA/admin provisioning, rate limiting, audit events, moderation workflows, and a managed image-storage service before public launch.
- Move local `public/uploads` storage to durable managed image storage before scaling beyond a single persistent host.
- Add privacy/terms, returns/dispute policies, seller onboarding/KYC, shipping, and applicable Georgian tax and consumer-protection review.

## Implemented API

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/categories`
- `GET /api/listings?q=&category=&page=&limit=`, authenticated `POST /api/listings`
- Authenticated `POST /api/uploads` for local listing-image uploads
- Owner-only `GET /api/profile/listings`, full-edit `PATCH /api/listings/:id`, and `DELETE /api/listings/:id`
- Authenticated `POST /api/favorites` (toggle)
- Authenticated `GET /api/orders` (purchases and sales)
- Authenticated `POST /api/checkout` (Stripe Connect single-listing checkout)
- Authenticated `POST /api/connect/onboard` (hosted Stripe seller onboarding)
- `POST /api/webhooks/stripe` (signature-verified order confirmation)
- Admin-only `/api/admin/*` routes for site statistics, listing management, user moderation, and category management

## Verification

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`. Database-backed pages and routes require the configured SQLite database and generated Prisma client.

## Not included yet

Email/phone verification and recovery, Google sign-in, chat, saved-favorite retrieval, listing detail pages, refunds/disputes, multi-seller cart, subscription plans, shipping integrations, push/email notifications, rate limiting, and TBC/Bank of Georgia payment adapters are not implemented. Do not treat this MVP as ready to launch publicly until those product, security, compliance, and operational requirements are completed and tested.
