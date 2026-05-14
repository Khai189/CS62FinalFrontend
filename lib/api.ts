import type {
  ActiveBidSummary,
  ApiResponse,
  AuthSession,
  AuthUser,
  BidHistorySummary,
  BidItem,
  Credentials,
  ItemSearchFilters,
  ListItemPayload,
  PlaceBidPayload,
  RegisterPayload
} from "@/lib/types";

const FRONTEND_PROXY_BASE = "/api/backend";

async function request<T>(
  path: string,
  init?: RequestInit,
  accessToken?: string
): Promise<ApiResponse<T>> {
  const response = await fetch(`${FRONTEND_PROXY_BASE}${path}`, {
    ...init,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
  register(payload: RegisterPayload) {
    return request<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  login(credentials: Credentials) {
    return request<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    });
  },

  getMe(accessToken: string) {
    return request<AuthUser>("/auth/me", { method: "GET" }, accessToken);
  },

  getAllItems(accessToken: string, filters?: ItemSearchFilters) {
    const params = new URLSearchParams();

    if (filters?.query) {
      params.set("query", filters.query);
    }
    if (filters?.auctioneerId) {
      params.set("auctioneerId", filters.auctioneerId);
    }
    if (typeof filters?.minPrice === "number") {
      params.set("minPrice", String(filters.minPrice));
    }
    if (typeof filters?.maxPrice === "number") {
      params.set("maxPrice", String(filters.maxPrice));
    }
    if (filters?.condition) {
      params.set("condition", filters.condition);
    }

    const queryString = params.toString();
    const path = queryString ? `/items/all?${queryString}` : "/items/all";
    return request<BidItem[]>(path, { method: "GET" }, accessToken);
  },

  listItem(accessToken: string, payload: ListItemPayload) {
    return request<string>(
      "/bid/list",
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      accessToken
    );
  },

  placeBid(accessToken: string, itemId: string, payload: PlaceBidPayload) {
    return request<string>(
      `/bid/${encodeURIComponent(itemId)}`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      accessToken
    );
  },

  getHighestBid(accessToken: string, itemId: string) {
    return request<string>(`/bid/${encodeURIComponent(itemId)}/highest`, { method: "GET" }, accessToken);
  },

  removeBid(accessToken: string, itemId: string) {
    return request<string>(`/bid/${encodeURIComponent(itemId)}`, { method: "DELETE" }, accessToken);
  },

  getActiveBids(accessToken: string) {
    return request<ActiveBidSummary[]>("/bid/active", { method: "GET" }, accessToken);
  },

  getBidHistory(accessToken: string) {
    return request<BidHistorySummary[]>("/bid/history", { method: "GET" }, accessToken);
  },

  getRecommendations(accessToken: string, bidderId: string, itemId: string, totalRecs: number) {
    return request<BidItem[]>(
      `/rec/${encodeURIComponent(bidderId)}/${encodeURIComponent(itemId)}/${totalRecs}`,
      { method: "GET" },
      accessToken
    );
  },

  getFeed(accessToken: string, bidderId: string) {
    return request<BidItem[]>(`/feed/${encodeURIComponent(bidderId)}`, { method: "GET" }, accessToken);
  }
};
