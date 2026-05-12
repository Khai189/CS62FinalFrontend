import type {
  ApiResponse,
  BidItem,
  Bidder,
  Credentials,
  ListItemPayload,
  PlaceBidPayload
} from "@/lib/types";

const FRONTEND_PROXY_BASE = "/api/backend";

function toBasicAuth(credentials: Credentials) {
  return `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
}

async function request<T>(
  path: string,
  credentials: Credentials,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(`${FRONTEND_PROXY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: toBasicAuth(credentials),
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const raw = await response.text();
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = raw && isJson ? (JSON.parse(raw) as T) : null;

  return {
    ok: response.ok,
    status: response.status,
    data,
    raw
  };
}

export const api = {
  getAllItems(credentials: Credentials) {
    return request<BidItem[]>("/items/all", credentials, { method: "GET" });
  },

  getAllBidders(credentials: Credentials) {
    return request<Bidder[]>("/bidders/all", credentials, { method: "GET" });
  },

  getBidder(credentials: Credentials, bidderId: string) {
    return request<Bidder>(`/bidders/${encodeURIComponent(bidderId)}`, credentials, {
      method: "GET"
    });
  },

  addBidder(credentials: Credentials, bidderId: string, name: string) {
    return request<string>(
      `/bidders/add/${encodeURIComponent(bidderId)}/${encodeURIComponent(name)}`,
      credentials,
      { method: "POST", headers: { "Content-Type": "text/plain" } }
    );
  },

  listItem(credentials: Credentials, payload: ListItemPayload) {
    return request<string>("/bid/list", credentials, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  placeBid(credentials: Credentials, itemId: string, payload: PlaceBidPayload) {
    return request<string>(`/bid/${encodeURIComponent(itemId)}`, credentials, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  getHighestBid(credentials: Credentials, itemId: string) {
    return request<string>(`/bid/${encodeURIComponent(itemId)}/highest`, credentials, {
      method: "GET"
    });
  },

  removeBid(credentials: Credentials, itemId: string, bidderId: string) {
    return request<string>(
      `/bid/${encodeURIComponent(itemId)}/${encodeURIComponent(bidderId)}`,
      credentials,
      { method: "DELETE" }
    );
  },

  getRecommendations(
    credentials: Credentials,
    bidderId: string,
    itemId: string,
    totalRecs: number
  ) {
    return request<BidItem[]>(
      `/rec/${encodeURIComponent(bidderId)}/${encodeURIComponent(itemId)}/${totalRecs}`,
      credentials,
      { method: "GET" }
    );
  },

  getFeed(credentials: Credentials, bidderId: string) {
    return request<BidItem[]>(`/feed/${encodeURIComponent(bidderId)}`, credentials, {
      method: "GET"
    });
  }
};
