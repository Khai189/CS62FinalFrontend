# 5CBid Frontend

This repository is the standalone Next.js + TypeScript + Tailwind frontend for the 5CBid marketplace. It gives students a real marketplace-style interface for signing up, signing in, browsing active listings, posting items, placing bids, checking the current top bid, and viewing recommendation/feed results from the Java backend. In practice, the app opens to a campus-market hero page, then lets buyers and sellers move through those flows from one screen.

## How To Run The Code

1. Make sure Node.js and npm are installed.
2. Make sure the backend is already running.
3. Copy `.env.example` to `.env.local`.
4. Set the backend URL variables.
5. Install dependencies and start the dev server.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Recommended `.env.local`:

```env
BACKEND_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_BACKEND_DISPLAY_URL=http://localhost:8080
```

## External Libraries

This project does not use a `/lib` folder of committed `.jar` files because it is a JavaScript/TypeScript app managed by npm.

Main frontend libraries:

- Next.js
- React
- Tailwind CSS
- TypeScript

Install them with:

```bash
npm install
```

## What The Frontend Exposes

The frontend does not expose a public REST API of its own. Its public-facing "API" is the exported helper methods and components that drive the user interface.

## Public Methods And Usage Examples

### `api.register(payload)`

- File: `lib/api.ts`
- Input: `RegisterPayload`
- Output: `Promise<ApiResponse<AuthSession>>`
- Description: Sends signup data to the backend and returns a JWT session when the account is created.

Example:

```ts
await api.register({
  username: "maya123",
  email: "maya@students.pomona.edu",
  password: "secret123",
  displayName: "Maya",
  role: "BIDDER"
});
```

### `api.login(credentials)`

- Input: `Credentials`
- Output: `Promise<ApiResponse<AuthSession>>`
- Description: Signs in a user and returns a session token plus user profile.

Example:

```ts
await api.login({ username: "maya123", password: "secret123" });
```

### `api.getMe(accessToken)`

- Input: JWT access token
- Output: `Promise<ApiResponse<AuthUser>>`
- Description: Loads the currently signed-in user.

Example:

```ts
await api.getMe(token);
```

### `api.getAllItems(accessToken, filters)`

- Input: JWT access token and optional `ItemSearchFilters`
- Output: `Promise<ApiResponse<BidItem[]>>`
- Description: Loads active marketplace listings and can filter by search text, seller, min/max opening bid, and condition.

Example:

```ts
await api.getAllItems(token, {
  query: "lamp",
  maxPrice: 25,
  condition: "USED"
});
```

### `api.listItem(accessToken, payload)`

- Input: JWT access token and `ListItemPayload`
- Output: `Promise<ApiResponse<ListedItemResponse>>`
- Description: Posts a new listing as a seller and returns the generated listing ID from the backend.

Example:

```ts
await api.listItem(token, {
  itemName: "Desk Lamp",
  startingPrice: 15,
  description: "Warm light for a dorm desk.",
  condition: "USED"
});
```

### `api.placeBid(accessToken, itemId, payload)`

- Input: JWT access token, item ID, and `PlaceBidPayload`
- Output: `Promise<ApiResponse<string>>`
- Description: Places a new bid on a listing.

Example:

```ts
await api.placeBid(token, "lamp-101", { amount: 22 });
```

### `api.getHighestBid(accessToken, itemId)`

- Input: JWT access token and item ID
- Output: `Promise<ApiResponse<string>>`
- Description: Loads the current top bid for one listing.

Example:

```ts
await api.getHighestBid(token, "lamp-101");
```

### `api.removeBid(accessToken, itemId)`

- Input: JWT access token and item ID
- Output: `Promise<ApiResponse<string>>`
- Description: Removes the signed-in bidder's active bid.

Example:

```ts
await api.removeBid(token, "lamp-101");
```

### `api.getRecommendations(accessToken, bidderId, itemId, totalRecs)`

- Input: JWT access token, bidder ID, item ID, recommendation count
- Output: `Promise<ApiResponse<BidItem[]>>`
- Description: Loads suggested listings related to one anchor item.

Example:

```ts
await api.getRecommendations(token, "maya123", "lamp-101", 3);
```

### `api.getFeed(accessToken, bidderId)`

- Input: JWT access token and bidder ID
- Output: `Promise<ApiResponse<BidItem[]>>`
- Description: Loads the personalized feed for one bidder.

Example:

```ts
await api.getFeed(token, "maya123");
```

### `api.getActiveBids(accessToken)`

- Input: JWT access token
- Output: `Promise<ApiResponse<ActiveBidSummary[]>>`
- Description: Loads the current live bidding activity for the signed-in user.

Example:

```ts
await api.getActiveBids(token);
```

### `api.getBidHistory(accessToken)`

- Input: JWT access token
- Output: `Promise<ApiResponse<BidHistorySummary[]>>`
- Description: Loads the signed-in user's past bid history or auction history.

Example:

```ts
await api.getBidHistory(token);
```

### `api.getExpiredBids(accessToken)`

- Input: JWT access token
- Output: `Promise<ApiResponse<BidHistorySummary[]>>`
- Description: Loads expired listing outcomes, including winners and closing prices.

Example:

```ts
await api.getExpiredBids(token);
```

## Public Components And Constructors

React components are used as the main public UI building blocks.

### `Dashboard()`

- File: `components/dashboard.tsx`
- Inputs: none directly; it manages local session and marketplace state
- Output: rendered marketplace page
- Description: main top-level screen for auth, listings, bids, seller tools, and recommendations

Usage example:

```tsx
<Dashboard />
```

### `ItemGrid(props)`

- File: `components/item-grid.tsx`
- Inputs:
  - `title`
  - `subtitle`
  - `items`
  - `emptyMessage`
  - optional `selectedItemId`
  - optional `onSelect`
- Output: rendered list/grid of listing cards

Usage example:

```tsx
<ItemGrid
  title="Open Listings"
  subtitle="Campus Marketplace"
  items={items}
  emptyMessage="No items yet."
/>
```

### `SectionCard(props)`

- File: `components/section-card.tsx`
- Inputs: `title`, `subtitle`, `children`
- Output: styled content section

Usage example:

```tsx
<SectionCard title="Your Account" subtitle="Profile">
  <p>Signed in as Maya</p>
</SectionCard>
```

### `StatusBanner(props)`

- File: `components/status-banner.tsx`
- Inputs: `title`, `body`, optional `tone`
- Output: styled status message

Usage example:

```tsx
<StatusBanner title="Marketplace Update" body="Listing posted." tone="success" />
```

## Backend Connection Notes

This frontend talks to the backend through the Next.js proxy route:

- `app/api/backend/[...path]/route.ts`

That route forwards requests to `BACKEND_API_BASE_URL` and passes through the JWT bearer token.

## Production Deployment

For Vercel:

- set `BACKEND_API_BASE_URL=https://your-api.up.railway.app`
- set `NEXT_PUBLIC_BACKEND_DISPLAY_URL=https://your-api.up.railway.app`

## Build Command

```bash
npm run build
```
