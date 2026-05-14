"use client";

import { useEffect, useMemo, useState } from "react";
import { ItemGrid } from "@/components/item-grid";
import { SectionCard } from "@/components/section-card";
import { StatusBanner } from "@/components/status-banner";
import { api } from "@/lib/api";
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

const SESSION_STORAGE_KEY = "ccbid-jwt-session";

function mergeItems(current: BidItem[], incoming: BidItem[]) {
  const merged = new Map<string, BidItem>();
  for (const item of current) {
    merged.set(item.itemId, item);
  }
  for (const item of incoming) {
    merged.set(item.itemId, item);
  }
  return Array.from(merged.values()).sort((a, b) => a.itemId.localeCompare(b.itemId));
}

function summarizeResponse(response: ApiResponse<unknown>) {
  return response.raw || `Request finished with status ${response.status}.`;
}

function toKnownItem(payload: ListItemPayload, user: AuthUser): BidItem {
  return {
    itemId: payload.itemId,
    itemName: payload.itemName,
    startingPrice: payload.startingPrice,
    description: null,
    auctioneer: {
      auctioneerId: user.profileId ?? user.username,
      name: user.displayName
    }
  };
}

export function Dashboard() {
  const backendDisplayUrl = process.env.NEXT_PUBLIC_BACKEND_DISPLAY_URL ?? "http://localhost:8080";

  const [session, setSession] = useState<AuthSession | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [loginForm, setLoginForm] = useState<Credentials>({ username: "", password: "" });
  const [signupForm, setSignupForm] = useState<RegisterPayload>({
    username: "",
    email: "",
    password: "",
    displayName: "",
    role: "BIDDER"
  });

  const [catalogItems, setCatalogItems] = useState<BidItem[]>([]);
  const [knownItems, setKnownItems] = useState<BidItem[]>([]);
  const [feedItems, setFeedItems] = useState<BidItem[]>([]);
  const [recommendedItems, setRecommendedItems] = useState<BidItem[]>([]);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [totalRecs, setTotalRecs] = useState(4);

  const [bidderId, setBidderId] = useState("");
  const [bidderName, setBidderName] = useState("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | "">("");
  const [itemPayload, setItemPayload] = useState<ListItemPayload>({
    itemId: "",
    itemName: "",
    startingPrice: 0
  });
  const [bidPayload, setBidPayload] = useState<PlaceBidPayload>({ amount: 0 });
  const [highestBidText, setHighestBidText] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [statusMessage, setStatusMessage] = useState(
    "Create an account or log in to browse the marketplace and use the bidding tools."
  );

  const currentUser = session?.user ?? null;
  const accessToken = session?.accessToken ?? null;
  const isBidder = currentUser?.role === "BIDDER";
  const isAuctioneer = currentUser?.role === "AUCTIONEER";
  const activeBidderId = isBidder ? currentUser?.profileId ?? currentUser?.username ?? "" : "";

  const authSummary = useMemo(() => {
    if (!accessToken) {
      return "Not signed in";
    }
    return `Bearer ${accessToken.slice(0, 18)}...`;
  }, [accessToken]);

  function persistSession(nextSession: AuthSession) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
  }

  function clearSession() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession(null);
    setCatalogItems([]);
    setKnownItems([]);
    setFeedItems([]);
    setRecommendedItems([]);
    setSelectedItemId("");
    setHighestBidText("");
  const authSummary = useMemo(
    () => `${credentials.username}:${"*".repeat(Math.max(credentials.password.length, 1))}`,
    [credentials]
  );

  const filteredFeed = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return feedItems.filter((item) => {
      const itemName = item.itemName?.toLowerCase() ?? "";
      const startingPrice = item.startingPrice ?? 0;

      const matchesSearch =
        normalizedSearchTerm === "" || itemName.includes(normalizedSearchTerm);
      const matchesPrice = maxPriceFilter === "" || startingPrice <= maxPriceFilter;
      return matchesSearch && matchesPrice;
    });
  }, [feedItems, searchTerm, maxPriceFilter]);

  function rememberBidders(incoming: Bidder[]) {
    setBidders((current) => {
      const merged = mergeBidders(current, incoming);
      const firstBidder = merged[0];
      if (firstBidder) {
        setSelectedBidderId((currentId) => currentId || firstBidder.bidderId);
        setLookupBidderId((currentId) => currentId || firstBidder.bidderId);
        setBidPayload((currentBid) => ({
          ...currentBid,
          bidderId: currentBid.bidderId || firstBidder.bidderId
        }));
        setRemoveBidderId((currentId) => currentId || firstBidder.bidderId);
      }
      return merged;
    });
  }

  function rememberItems(incoming: BidItem[]) {
    setKnownItems((current) => {
      const merged = mergeItems(current, incoming);
      if (!selectedItemId && merged[0]) {
        setSelectedItemId(merged[0].itemId);
      }
      return merged;
    });
  }

  async function runAction<T>(
    label: string,
    work: () => Promise<ApiResponse<T>>,
    onSuccess?: (response: ApiResponse<T>) => void
  ) {
    setLoadingLabel(label);
    try {
      const response = await work();
      if (response.ok) {
        setStatusTone("success");
        setStatusMessage(summarizeResponse(response));
        onSuccess?.(response);
      } else {
        setStatusTone("error");
        setStatusMessage(response.raw || `Request failed with status ${response.status}.`);
      }
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(error instanceof Error ? error.message : "Unknown network error.");
    } finally {
      setLoadingLabel(null);
    }
  }

  useEffect(() => {
    const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!storedSession) {
      return;
    }
    const storedSessionValue = storedSession;

    let cancelled = false;

    async function hydrateSession() {
      try {
        const parsed = JSON.parse(storedSessionValue) as AuthSession;
        const response = await api.getMe(parsed.accessToken);
        if (cancelled) {
          return;
        }

        if (response.ok && response.data) {
          const restoredSession = { ...parsed, user: response.data };
          setSession(restoredSession);
          persistSession(restoredSession);
          setStatusTone("neutral");
          setStatusMessage("Welcome back. Your JWT session was restored.");
        } else {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } catch {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }

    void hydrateSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accessToken || !currentUser) {
      return;
    }
    const token = accessToken;

    let cancelled = false;

    async function loadCatalog() {
      const response = await api.getAllItems(token);
      if (cancelled) {
        return;
      }

      if (response.ok && response.data) {
        setCatalogItems(response.data);
        rememberItems(response.data);
        setStatusTone("neutral");
        setStatusMessage("Connected. Browse the marketplace and use the tools for your account role.");
      } else if (!cancelled) {
        setCatalogItems([]);
        setStatusTone("error");
        setStatusMessage(response.raw || "Could not load marketplace items.");
      }
    }

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentUser, reloadKey]);

  useEffect(() => {
    if (!accessToken || !currentUser || !activeBidderId) {
      setFeedItems([]);
      setRecommendedItems([]);
      return;
    }
    const token = accessToken;
    const bidderProfileId = activeBidderId;

    let cancelled = false;

    async function loadFeed() {
      const response = await api.getFeed(token, bidderProfileId);
      if (cancelled) {
        return;
      }

      if (response.ok && response.data) {
        setFeedItems(response.data);
        rememberItems(response.data);
      } else {
        setFeedItems([]);
      }
    }

    void loadFeed();
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeBidderId, currentUser, reloadKey]);

  useEffect(() => {
    if (!accessToken || !currentUser || !activeBidderId || !selectedItemId) {
      setRecommendedItems([]);
      return;
    }
    const token = accessToken;
    const bidderProfileId = activeBidderId;
    const anchorItemId = selectedItemId;

    let cancelled = false;

    async function loadRecommendations() {
      const response = await api.getRecommendations(token, bidderProfileId, anchorItemId, totalRecs);
      if (cancelled) {
        return;
      }

      if (response.ok && response.data) {
        setRecommendedItems(response.data);
        rememberItems(response.data);
      } else {
        setRecommendedItems([]);
      }
    }

    void loadRecommendations();
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeBidderId, currentUser, selectedItemId, totalRecs, reloadKey]);

  function handleSelectItem(item: BidItem) {
    setSelectedItemId(item.itemId);
  }

  return (
    <main className="px-4 py-8 md:px-8 md:py-10">
      <datalist id="item-id-options">
        {knownItems.map((item) => (
          <option key={item.itemId} value={item.itemId}>
            {item.itemName ?? item.itemId}
          </option>
        ))}
      </datalist>

      <div className="mx-auto max-w-7xl">
        <div className="mb-8 overflow-hidden rounded-[2.5rem] border border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(255,245,228,0.84))] p-8 shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-ember">5CBid</p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl text-ink md:text-6xl">A bidding site with JWT auth, seller tools, and recommendations</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate md:text-lg">
                Sign up as a bidder or auctioneer, browse live marketplace items, place bids,
                list products for sale, and get recommendation results from the Spring backend at {backendDisplayUrl}.
              </p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/70 px-5 py-4 text-sm text-slate">
              <p>Session: {authSummary}</p>
              <p>User: {currentUser ? `${currentUser.displayName} (${currentUser.role})` : "Guest"}</p>
              <p>{loadingLabel ? `Working: ${loadingLabel}` : "Ready"}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <StatusBanner title="Site Status" body={statusMessage} tone={statusTone} />

          {!currentUser || !accessToken ? (
            <SectionCard title="Access Your Account" subtitle="JWT Login Or Signup">
              <div className="mb-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    authMode === "login" ? "bg-ink text-white" : "bg-white/80 text-slate"
                  }`}
                  onClick={() => setAuthMode("login")}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    authMode === "signup" ? "bg-tide text-white" : "bg-white/80 text-slate"
                  }`}
                  onClick={() => setAuthMode("signup")}
                >
                  Create account
                </button>
              </div>

              {authMode === "login" ? (
                <div className="grid gap-4 md:max-w-xl">
                  <label className="grid gap-2 text-sm text-slate">
                    Username
                    <input
                      className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                      value={loginForm.username}
                      onChange={(event) =>
                        setLoginForm((current) => ({ ...current, username: event.target.value }))
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate">
                    Password
                    <input
                      className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                      type="password"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((current) => ({ ...current, password: event.target.value }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="w-fit rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white"
                    onClick={() =>
                      runAction("Log in", () => api.login(loginForm), (response) => {
                        if (!response.data) {
                          return;
                        }
                        setSession(response.data);
                        persistSession(response.data);
                        setStatusMessage(`Signed in as ${response.data.user.displayName}.`);
                      })
                    }
                  >
                    Log in
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm text-slate">
                    Username
                    <input
                      className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                      value={signupForm.username}
                      onChange={(event) =>
                        setSignupForm((current) => ({ ...current, username: event.target.value }))
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate">
                    Email
                    <input
                      className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                      type="email"
                      value={signupForm.email}
                      onChange={(event) =>
                        setSignupForm((current) => ({ ...current, email: event.target.value }))
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate">
                    Password
                    <input
                      className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                      type="password"
                      value={signupForm.password}
                      onChange={(event) =>
                        setSignupForm((current) => ({ ...current, password: event.target.value }))
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate">
                    Display name
                    <input
                      className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                      value={signupForm.displayName}
                      onChange={(event) =>
                        setSignupForm((current) => ({ ...current, displayName: event.target.value }))
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate">
                    Account type
                    <select
                      className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                      value={signupForm.role}
                      onChange={(event) =>
                        setSignupForm((current) => ({
                          ...current,
                          role: event.target.value as RegisterPayload["role"]
                        }))
                      }
                    >
                      <option value="BIDDER">Bidder</option>
                      <option value="AUCTIONEER">Auctioneer</option>
                    </select>
                  </label>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      className="w-fit rounded-full bg-tide px-5 py-2 text-sm font-semibold text-white"
                      onClick={() =>
                        runAction("Create account", () => api.register(signupForm), (response) => {
                          if (!response.data) {
                            return;
                          }
                          setSession(response.data);
                          persistSession(response.data);
                          setLoginForm({
                            username: signupForm.username,
                            password: ""
                          });
                          setStatusMessage(`Welcome to 5CBid, ${response.data.user.displayName}.`);
                        })
                      }
                    >
                      Create account
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          ) : (
            <>
              <SectionCard title="Your Session" subtitle="JWT Profile">
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="grid gap-2 text-sm text-slate">
                    <p>Signed in as {currentUser.displayName}</p>
                    <p>Username: {currentUser.username}</p>
                    <p>Role: {currentUser.role}</p>
                    <p>Email: {currentUser.email}</p>
                    <p>Profile ID: {currentUser.profileId ?? "No bidder or auctioneer profile"}</p>
                  </div>
                  <button
                    type="button"
                    className="w-fit rounded-full bg-ember px-5 py-2 text-sm font-semibold text-white"
                    onClick={() => {
                      clearSession();
                      setStatusTone("neutral");
                      setStatusMessage("You signed out. Log back in or create another account.");
                    }}
                  >
                    Log out
                  </button>
                </div>
              </SectionCard>

          {/* Marketplace with Filters */}
          <SectionCard
            title="Marketplace"
            subtitle="Live catalog of active items."
          >
            {/* Filter Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Search Item Type/Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Textbook, Laptop..."
                  className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Max Price ($)
                </label>
                <input
                  type="number"
                  placeholder="Any price"
                  className="w-full rounded-lg border-slate-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setMaxPriceFilter("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {filteredFeed.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                No items match your current filters or the marketplace is empty.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredFeed.map((item) => (
                  <div
                    key={item.itemId}
                    className={`rounded-2xl border border-[color:var(--line)] bg-white/80 p-4 py-3 text-ink shadow-sm transition-all ${
                      selectedItemId === item.itemId ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setSelectedItemId(item.itemId)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{item.itemName}</h3>
                      <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                        ${item.startingPrice}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-1">ID: {item.itemId}</p>
                    <p className="text-xs text-slate-500">Auctioneer: {item.auctioneer?.auctioneerId || 'Unknown'}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

              {isBidder ? (
                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-slate">
                  Search feed
                  <input
                    className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                    placeholder="Search by name"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate">
                  Max price
                  <input
                    className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                    placeholder="No max"
                    type="number"
                    min={0}
                    value={maxPriceFilter}
                    onChange={(event) =>
                      setMaxPriceFilter(event.target.value === "" ? "" : Number(event.target.value))
                    }
                  />
                </label>
              </div>

                    <ItemGrid
                      title="Your Feed"
                      subtitle="For You"
                      items={filteredFeed}
                      selectedItemId={selectedItemId}
                      emptyMessage="Your feed is empty right now. Start bidding and come back for more signal."
                      onSelect={handleSelectItem}
                    />
            </div>

                  <SectionCard title="Recommendations" subtitle="Because You Bid">
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                      <label className="grid gap-2 text-sm text-slate">
                        Anchor item ID
                        <input
                          className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                          list="item-id-options"
                          value={selectedItemId}
                          onChange={(event) => setSelectedItemId(event.target.value)}
                        />
                      </label>
                      <label className="grid gap-2 text-sm text-slate">
                        Total recs
                        <input
                          className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                          type="number"
                          min={1}
                          value={totalRecs}
                          onChange={(event) => setTotalRecs(Number(event.target.value))}
                        />
                      </label>
                    </div>

                    <div className="mt-5">
                      <ItemGrid
                        title="Recommended Next"
                        subtitle="Personalized"
                        items={recommendedItems}
                        selectedItemId={selectedItemId}
                        emptyMessage="Choose an item from the marketplace or feed to load recommendations."
                        onSelect={handleSelectItem}
                      />
                    </div>
                  </SectionCard>
                </div>
              ) : (
                <SectionCard title="Recommendations And Feed" subtitle="Bidder Features">
                  <p className="text-sm leading-7 text-slate">
                    Personalized feeds and recommendation results are currently bidder-only features.
                    Create a bidder account if you want the site to tailor items to your bidding history.
                  </p>
                </SectionCard>
              )}

              <div className="grid gap-6 xl:grid-cols-2">
                <SectionCard title="Sell an Item" subtitle="Auctioneer">
                  {isAuctioneer ? (
                    <>
                      <div className="grid gap-3">
                        <input
                          className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                          placeholder="Item ID"
                          value={itemPayload.itemId}
                          onChange={(event) =>
                            setItemPayload((current) => ({ ...current, itemId: event.target.value }))
                          }
                        />
                        <input
                          className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                          placeholder="Item name"
                          value={itemPayload.itemName}
                          onChange={(event) =>
                            setItemPayload((current) => ({ ...current, itemName: event.target.value }))
                          }
                        />
                        <input
                          className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                          placeholder="Starting price"
                          type="number"
                          value={itemPayload.startingPrice}
                          onChange={(event) =>
                            setItemPayload((current) => ({
                              ...current,
                              startingPrice: Number(event.target.value)
                            }))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className="mt-4 rounded-full bg-tide px-4 py-2 text-sm font-semibold text-white"
                        onClick={() =>
                          runAction("List item", () => api.listItem(accessToken, itemPayload), (response) => {
                            if (!response.ok || !currentUser || !itemPayload.itemId) {
                              return;
                            }
                            const item = toKnownItem(itemPayload, currentUser);
                            setCatalogItems((current) => mergeItems(current, [item]));
                            rememberItems([item]);
                            setSelectedItemId(item.itemId);
                            setItemPayload({ itemId: "", itemName: "", startingPrice: 0 });
                            setReloadKey((current) => current + 1);
                          })
                        }
                      >
                        List item
                      </button>
                    </>
                  ) : (
                    <p className="text-sm leading-7 text-slate">
                      Only auctioneer accounts can create listings. If you want to sell items, sign up as an auctioneer.
                    </p>
                  )}
                </SectionCard>

                <SectionCard title="Bid on an Item" subtitle="Bidder">
                  {isBidder ? (
                    <>
                      <div className="grid gap-3">
                        <input
                          className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                          list="item-id-options"
                          placeholder="Item ID"
                          value={selectedItemId}
                          onChange={(event) => setSelectedItemId(event.target.value)}
                        />
                        <input
                          className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                          placeholder="Bid amount"
                          type="number"
                          value={bidPayload.amount}
                          onChange={(event) =>
                            setBidPayload({ amount: Number(event.target.value) })
                          }
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white"
                          onClick={() =>
                            runAction("Place bid", () => api.placeBid(accessToken, selectedItemId, bidPayload), () => {
                              setReloadKey((current) => current + 1);
                            })
                          }
                        >
                          Place bid
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                          onClick={() =>
                            runAction("Check highest bid", () => api.getHighestBid(accessToken, selectedItemId), (response) => {
                              setHighestBidText(response.raw);
                            })
                          }
                        >
                          Check highest bid
                        </button>
                        <button
                          type="button"
                          className="rounded-full bg-ember px-4 py-2 text-sm font-semibold text-white"
                          onClick={() =>
                            runAction("Remove bid", () => api.removeBid(accessToken, selectedItemId), () => {
                              setReloadKey((current) => current + 1);
                            })
                          }
                        >
                          Remove my bid
                        </button>
                      </div>
                      {highestBidText ? (
                        <p className="mt-4 rounded-3xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-slate">
                          {highestBidText}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm leading-7 text-slate">
                      Only bidder accounts can place or remove bids. Switch to a bidder account to use these actions.
                    </p>
                  )}
                </SectionCard>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
