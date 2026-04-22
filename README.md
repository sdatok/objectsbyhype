# Objectsbyhype

Objectsbyhype is a designer furniture and home objects webstore built with Next.js, Prisma, and Stripe.

## Stack
- Next.js 16 + TypeScript
- Tailwind CSS v4
- Prisma + Postgres (Neon)
- Stripe Checkout + Stripe Webhooks
- Vercel Blob for product media

## Local Development
1. Copy env vars:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Push schema to your database:
   ```bash
   npm run db:push
   ```
4. Start dev server:
   ```bash
   npm run dev
   ```

Storefront: `http://localhost:3000`  
Admin: `http://localhost:3000/admin`

## Fulfillment Workflow
Orders are tracked with a manual-first dropship flow:

`PAID -> SUPPLIER_ORDERED -> SUPPLIER_SHIPPED -> DELIVERED`

Admin can update:
- supplier order reference
- carrier
- tracking number
- fulfillment notes

## Deployment on Vercel
1. Push this repo to GitHub.
2. Create a new project in Vercel.
3. Add all env vars from `.env.example`.
4. Set `NEXT_PUBLIC_APP_URL=https://objectsbyhype.com`.
5. Configure Stripe webhook endpoint:
   - `https://objectsbyhype.com/api/webhooks/stripe`
6. Connect and set `objectsbyhype.com` as the primary domain.

## Notes
- Keep `SESSION_SECRET` set in all environments.
- Use `npm run seed` for initial furniture demo products.
