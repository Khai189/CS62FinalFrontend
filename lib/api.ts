import type {
  ApiResponse,
  AuthSession,
  AuthUser,
  BidItem,
  Credentials,
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

  getAllItems(accessToken: string) {
    return request<BidItem[]>("/items/all", { method: "GET" }, accessToken);
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
