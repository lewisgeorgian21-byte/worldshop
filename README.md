# World Market

World Market is a Georgian-first, responsive marketplace MVP built with Next.js, TypeScript, Prisma, SQLite for local development, PostgreSQL for production, and optional Stripe Connect. It includes account registration and login, seller listings, favorites, order history APIs, seller payment onboarding, and a webhook-confirmed single-item checkout flow. It does not claim that a payment succeeded until Stripe verifies it. This is a working foundation, not yet the complete production marketplace described in the original product brief.

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

In local development, listing photos are uploaded as JPEG, PNG, or WebP files (up to 5 MB each, 8 per listing) and stored under `public/uploads`. On Vercel, uploads use authenticated Vercel Blob client uploads so files are not limited by the Vercel Function request-size limit and persist across deployments. The image URL field remains available as an optional fallback.

## Payments

Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, a Stripe-supported `STRIPE_CONNECT_COUNTRY`, and `PLATFORM_COMMISSION_PERCENT` to use Stripe Checkout. Sellers can start hosted Stripe Express onboarding from the listing form. Run Stripe's local webhook forwarder against `/api/webhooks/stripe` during development. Listing prices are whole GEL; order amount/commission values are stored in tetri (minor units). Checkout creates a pending order; the signed Stripe webhook is the only path that marks an order paid and the listing sold.

Stripe Connect destination charges require a Stripe account and merchant model eligible for the selected country, account type, and payment method. Confirm local legal and provider requirements before taking live payments. TBC and Bank of Georgia gateway credentials/adapters are not included; do not enable a gateway until its official merchant integration and signed callback handling are implemented and tested.

## Deploy to Vercel

The production Prisma schema and migrations use PostgreSQL. Local development continues to use SQLite and `prisma/dev.db`; the local database and `.env` are not changed by the production setup. The PostgreSQL migration history keeps the existing initial migration and adds a follow-up migration that brings its older schema up to date, including converting `Listing.imageUrls` to JSONB and backfilling listing expirations.

1. Push the `marketplace` directory to a Git provider and import the project into Vercel. Set **Root Directory** to `marketplace`, leave the framework preset as Next.js, and use Node.js 20 or newer. `npm run build` generates the PostgreSQL Prisma Client before building Next.js.
2. Create a PostgreSQL database on Neon (its free tier is subject to current provider limits). Add both connection strings to the Vercel project for Preview and Production:
   - `DATABASE_URL`: Neon pooled connection string for application requests.
   - `DIRECT_URL`: direct, unpooled connection string for Prisma migrations.
   Both must target the same database and include the provider's required SSL options. Do not put either URL in source control.
3. Create and connect a Vercel Blob store to the Vercel project. Its `BLOB_READ_WRITE_TOKEN` must be available to the deployment. Blob usage is subject to Vercel's current plan quotas and pricing.
4. Configure application variables in Vercel:
   - `APP_URL`: the public HTTPS production URL (recommended for Stripe return links; `VERCEL_URL` is used as a fallback).
   - `BLOB_READ_WRITE_TOKEN`: Vercel Blob read/write token, normally added by connecting the Blob store.
   - `ADMIN_EMAIL`: optional email to grant admin access after that account registers and signs in.
   - `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`: optional one-time super-admin creation values for the seed command. Remove these from the Vercel project after seeding.
   - `SEED_DEMO_LISTINGS`: set to `false` for a production catalog without demo listings.
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_COUNTRY`, and `PLATFORM_COMMISSION_PERCENT`: optional payment configuration. Checkout should not be enabled until the Stripe account, Connect country, webhook, and required legal/provider settings are ready.
   - No session/auth secret is currently required. Sessions use random tokens stored as hashes in the database.
5. Link the Vercel project from the `marketplace` directory, then apply the checked-in migrations and seed the production category catalog. With Vercel CLI installed and the project linked, run:

   ```powershell
   npx vercel env run --environment production -- npm run db:deploy
   npx vercel env run --environment production -- npm run db:seed:prod
   ```

   The seed command creates categories and, only when configured, the bootstrap admin. Demo listings are skipped when `SEED_DEMO_LISTINGS=false`. Migrations are not run from the build command.
6. Deploy from Vercel and verify the deployment URL loads, registration/login works, a listing can be created, and an uploaded image still loads after a new deployment. Verify Stripe separately in test mode before adding live credentials.

For schema changes, create and review PostgreSQL migrations with `npm run db:migrate` against a development PostgreSQL database, commit the generated migration, and run `npm run db:deploy` for deployment. Do not use `db push` against production; it bypasses the reviewed migration history.

### Environment variables

| Variable | Required when | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | Pooled Neon PostgreSQL application connection. Locally, use `file:./dev.db`. |
| `DIRECT_URL` | Production Prisma generation/migrations | Direct Neon PostgreSQL connection for migration operations. |
| `BLOB_READ_WRITE_TOKEN` | Production image uploads | Authenticated Vercel Blob uploads and cleanup. |
| `APP_URL` | Recommended in production | Public site origin for Stripe return URLs; `VERCEL_URL` is a fallback. |
| `ADMIN_EMAIL` | Optional | Promotes the matching account to admin at sign-in. |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | Optional, initial seed only | Creates a super-admin if that email does not already exist. |
| `SEED_DEMO_LISTINGS` | Optional | Defaults to `true`; set to `false` to seed categories without demo listings. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_COUNTRY`, `PLATFORM_COMMISSION_PERCENT` | Only for Stripe payments | Stripe Connect and checkout configuration. |

`DATABASE_URL` in `.env.example` is intentionally SQLite for local development. Set the production PostgreSQL values in Vercel's encrypted environment-variable settings; never replace the local `.env` with production credentials or commit secrets.

## Implemented API

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/categories`
- `GET /api/listings?q=&category=&page=&limit=`, authenticated `POST /api/listings`
- Authenticated `POST /api/uploads` for local listing-image uploads and Vercel Blob client-upload token generation
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
