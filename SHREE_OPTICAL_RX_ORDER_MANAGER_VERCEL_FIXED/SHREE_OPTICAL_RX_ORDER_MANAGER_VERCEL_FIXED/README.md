# Shree Optical RX Order Manager

## IMPORTANT: How to deploy on Vercel

This is a **Next.js application**. Do **NOT** deploy the source ZIP using **Vercel Drop**.
Vercel Drop treats an uploaded source package differently and can produce a deployment that says Ready but returns 404 at the website URL.

### Recommended deployment

1. Extract this ZIP on your computer.
2. Upload the extracted project to a GitHub repository.
3. Go to Vercel → Add New → Project.
4. Import the GitHub repository.
5. Vercel should detect **Next.js** automatically.
6. Add Environment Variable:
   - Name: `DATABASE_URL`
   - Value: your Neon PostgreSQL connection string
   - Environment: Production, Preview, Development
7. Click Deploy.

Do not change the Root Directory unless you placed the project inside another folder in GitHub.

## API routes included

- `/api/dashboard`
- `/api/orders`
- `/api/orders/[id]`
- `/api/products`
- `/api/products/[id]`
- `/api/settings`

The database tables are created automatically on the first successful API request.
