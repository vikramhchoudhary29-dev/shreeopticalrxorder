# Shree Optical RX Order Manager

Production-ready Next.js RX order manager for SIZAL/Lens RX and Glass RX orders.

## Stack

- Next.js 15
- React 19
- Neon PostgreSQL
- SheetJS (`xlsx`) for Excel imports
- Vercel deployment

## Environment

Set this environment variable in Vercel:

`DATABASE_URL`

Do not commit `.env` files or database credentials.

## First-time setup after deployment

1. Open **Settings**.
2. Set/verify the **Mumbai office / Admin WhatsApp number**.
3. Review the SIZAL and Glass RX WhatsApp templates.
4. Click **Load supplied product file into Neon**.
5. Click **Load supplied customer master**.
6. Confirm the Products page shows the imported product records.
7. Create a test order and verify the three-button sharing popup.

## GitHub / Vercel structure

The repository root is the Next.js project root. `package.json` must be at the repository root. Do not set a nested Root Directory in Vercel for this cleaned version.

## Data model

All products, pricing rules, customers, orders, counters and WhatsApp settings are stored in Neon PostgreSQL so they are shared across devices.

Customer imports intentionally store only:

- Name
- Mobile

All other customer Excel columns are ignored.
