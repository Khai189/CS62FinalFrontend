# Frontend

This folder is a standalone Next.js + TypeScript + Tailwind frontend for the Java backend in `../CS62FinalProject/demo`.

## Why it is separate

`frontend/` lives at the repo root, outside the Java project, so you can move it into its own repository and deploy it independently.

## Covered backend endpoints

- `GET /items/all`
- `GET /bidders/all`
- `GET /bidders/{bidderId}`
- `POST /bidders/add/{bidderId}/{name}`
- `POST /bid/list`
- `POST /bid/{itemId}`
- `GET /bid/{itemId}/highest`
- `DELETE /bid/{itemId}/{bidderId}`
- `GET /rec/{bidderId}/{itemId}/{totalRecs}`
- `GET /feed/{bidderId}`

## Local setup

1. Copy `.env.example` to `.env.local`
2. Set `BACKEND_API_BASE_URL=http://localhost:8080`
3. Optionally set `NEXT_PUBLIC_BACKEND_DISPLAY_URL=http://localhost:8080`
4. Make sure the backend is running against Postgres
5. Install dependencies with `npm install`
6. Start the app with `npm run dev`

## Auth

The current backend uses HTTP Basic auth. The browser calls the Next.js `/api/backend/*` proxy, and that proxy forwards the `Authorization` header to Spring. The UI includes presets for:

- `admin / admin`
- `auctioneer / auctioneer`
- `bidder / bidder`

## Deployment note

Before deploying this frontend to Vercel or another domain:

- set `BACKEND_API_BASE_URL` to the deployed Spring backend URL
- set `APP_SECURITY_ALLOWED_ORIGINS` on the backend if you still want direct browser access from trusted origins
- keep the frontend proxy in place to avoid most browser CORS friction
