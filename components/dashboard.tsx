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
    "Create an account to browse live student listings, place bids, or post something of your own."
  );

  const currentUser = session?.user ?? null;
  const accessToken = session?.accessToken ?? null;
  const isBidder = currentUser?.role === "BIDDER";
  const isAuctioneer = currentUser?.role === "AUCTIONEER";
  const activeBidderId = isBidder ? currentUser?.profileId ?? currentUser?.username ?? "" : "";

  const authSummary = useMemo(() => {
    if (!accessToken) {
      return "Guest browsing mode";
    }
    return `Signed in with secure access`;
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
          setStatusMessage("Welcome back. Your account is ready and the market is open.");
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
        setStatusMessage("Browse open listings, jump into a bidding war, or post your own item for sale.");
      } else {
        setCatalogItems([]);
        setStatusTone("error");
        setStatusMessage(response.raw || "We could not load the marketplace right now.");
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
        <div className="surface-panel relative mb-8 overflow-hidden p-8 md:p-10">
          <div className="absolute inset-y-0 right-0 hidden w-80 bg-[radial-gradient(circle_at_top,rgba(47,111,115,0.18),transparent_58%)] lg:block" />
          <p className="section-eyebrow text-ember">5CBid</p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="max-w-4xl text-4xl text-ink md:text-6xl">
                Buy and sell around the 5Cs without the awkward spreadsheet scramble.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate md:text-lg">
                5CBid is a campus marketplace for auction-style listings. Students can post items,
                place bids, and get suggestions based on what they have been interested in already.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="hero-chip">Student listings</span>
                <span className="hero-chip">Live bids</span>
                <span className="hero-chip">Personalized suggestions</span>
              </div>
            </div>
            <div className="glass-tile max-w-sm px-5 py-4 text-sm text-slate">
              <p className="section-eyebrow mb-3">Market Status</p>
              <div className="grid gap-2">
                <p>{authSummary}</p>
                <p>{currentUser ? `${currentUser.displayName} is signed in as ${currentUser.role.toLowerCase()}` : "No one is signed in yet"}</p>
                <p>{loadingLabel ? `Working on: ${loadingLabel}` : "Ready for browsing"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <StatusBanner title="Marketplace Update" body={statusMessage} tone={statusTone} />

          {!currentUser || !accessToken ? (
            <SectionCard title="Join the Marketplace" subtitle="Sign In Or Create An Account">
              <div className="mb-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    authMode === "login" ? "bg-ink text-white shadow-sm" : "bg-white/80 text-slate"
                  }`}
                  onClick={() => setAuthMode("login")}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    authMode === "signup" ? "bg-tide text-white shadow-sm" : "bg-white/80 text-slate"
                  }`}
                  onClick={() => setAuthMode("signup")}
                >
                  Create account
                </button>
              </div>

              {authMode === "login" ? (
                <div className="grid gap-4 md:max-w-xl">
                  <label className="field-label">
                    Username
                    <input
                      className="field-input"
                      value={loginForm.username}
                      onChange={(event) =>
                        setLoginForm((current) => ({ ...current, username: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field-label">
                    Password
                    <input
                      className="field-input"
                      type="password"
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((current) => ({ ...current, password: event.target.value }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="primary-button button-ink w-fit"
                    onClick={() =>
                      runAction("Signing in", () => api.login(loginForm), (response) => {
                        if (!response.data) {
                          return;
                        }
                        setSession(response.data);
                        persistSession(response.data);
                        setStatusMessage(`Welcome back, ${response.data.user.displayName}.`);
                      })
                    }
                  >
                    Sign in
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="field-label">
                    Username
                    <input
                      className="field-input"
                      value={signupForm.username}
                      onChange={(event) =>
                        setSignupForm((current) => ({ ...current, username: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field-label">
                    Email
                    <input
                      className="field-input"
                      type="email"
                      value={signupForm.email}
                      onChange={(event) =>
                        setSignupForm((current) => ({ ...current, email: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field-label">
                    Password
                    <input
                      className="field-input"
                      type="password"
                      value={signupForm.password}
                      onChange={(event) =>
                        setSignupForm((current) => ({ ...current, password: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field-label">
                    Display name
                    <input
                      className="field-input"
                      value={signupForm.displayName}
                      onChange={(event) =>
                        setSignupForm((current) => ({ ...current, displayName: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field-label">
                    Account type
                    <select
                      className="field-input"
                      value={signupForm.role}
                      onChange={(event) =>
                        setSignupForm((current) => ({
                          ...current,
                          role: event.target.value as RegisterPayload["role"]
                        }))
                      }
                    >
                      <option value="BIDDER">Buyer / bidder</option>
                      <option value="AUCTIONEER">Seller / auctioneer</option>
                    </select>
                  </label>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      className="primary-button button-tide w-fit"
                      onClick={() =>
                        runAction("Creating account", () => api.register(signupForm), (response) => {
                          if (!response.data) {
                            return;
                          }
                          setSession(response.data);
                          persistSession(response.data);
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
              <SectionCard title="Your Account" subtitle="Marketplace Profile">
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="grid gap-2 text-sm text-slate">
                    <p>Signed in as {currentUser.displayName}</p>
                    <p>Username: {currentUser.username}</p>
                    <p>Account type: {currentUser.role}</p>
                    <p>Email: {currentUser.email}</p>
                    <p>Profile ID: {currentUser.profileId ?? "No active marketplace profile"}</p>
                  </div>
                  <button
                    type="button"
                    className="primary-button button-ember w-fit"
                    onClick={() => {
                      clearSession();
                      setStatusTone("neutral");
                      setStatusMessage("You signed out. Come back when you are ready to browse again.");
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </SectionCard>

              <ItemGrid
                title="Open Listings"
                subtitle="Campus Marketplace"
                items={catalogItems}
                selectedItemId={selectedItemId}
                emptyMessage="No listings are live yet. A seller can post the first item."
                onSelect={handleSelectItem}
              />

              {isBidder ? (
                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <ItemGrid
                    title="Picked For You"
                    subtitle="Your Feed"
                    items={feedItems}
                    selectedItemId={selectedItemId}
                    emptyMessage="Your feed is quiet right now. Bid on a few items and this section will learn your taste."
                    onSelect={handleSelectItem}
                  />

                  <SectionCard title="You Might Also Like" subtitle="Recommendations">
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                      <label className="field-label">
                        Start from this listing
                        <input
                          className="field-input"
                          list="item-id-options"
                          value={selectedItemId}
                          onChange={(event) => setSelectedItemId(event.target.value)}
                        />
                      </label>
                      <label className="field-label">
                        Number of suggestions
                        <input
                          className="field-input"
                          type="number"
                          min={1}
                          value={totalRecs}
                          onChange={(event) => setTotalRecs(Number(event.target.value))}
                        />
                      </label>
                    </div>

                    <div className="mt-5">
                      <ItemGrid
                        title="Related Listings"
                        subtitle="Based On Your Activity"
                        items={recommendedItems}
                        selectedItemId={selectedItemId}
                        emptyMessage="Pick a listing from the market or your feed to load suggestions."
                        onSelect={handleSelectItem}
                      />
                    </div>
                  </SectionCard>
                </div>
              ) : (
                <SectionCard title="Recommendations" subtitle="Buyer Feature">
                  <p className="text-sm leading-7 text-slate">
                    Personalized suggestions are built for bidder accounts. If you want the site to
                    learn what you like, create a buyer account and start bidding.
                  </p>
                </SectionCard>
              )}

              <div className="grid gap-6 xl:grid-cols-2">
                <SectionCard title="Post A Listing" subtitle="Seller Tools">
                  {isAuctioneer ? (
                    <>
                      <div className="grid gap-3">
                        <input
                          className="field-input"
                          placeholder="Listing ID"
                          value={itemPayload.itemId}
                          onChange={(event) =>
                            setItemPayload((current) => ({ ...current, itemId: event.target.value }))
                          }
                        />
                        <input
                          className="field-input"
                          placeholder="Listing title"
                          value={itemPayload.itemName}
                          onChange={(event) =>
                            setItemPayload((current) => ({ ...current, itemName: event.target.value }))
                          }
                        />
                        <input
                          className="field-input"
                          placeholder="Opening bid"
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
                        className="primary-button button-tide mt-4"
                        onClick={() =>
                          runAction("Posting listing", () => api.listItem(accessToken, itemPayload), (response) => {
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
                        Post listing
                      </button>
                    </>
                  ) : (
                    <p className="text-sm leading-7 text-slate">
                      Only seller accounts can post listings. If you want to sell something around the 5Cs,
                      create an auctioneer account.
                    </p>
                  )}
                </SectionCard>

                <SectionCard title="Place A Bid" subtitle="Buyer Tools">
                  {isBidder ? (
                    <>
                      <div className="grid gap-3">
                        <input
                          className="field-input"
                          list="item-id-options"
                          placeholder="Listing ID"
                          value={selectedItemId}
                          onChange={(event) => setSelectedItemId(event.target.value)}
                        />
                        <input
                          className="field-input"
                          placeholder="Your bid"
                          type="number"
                          value={bidPayload.amount}
                          onChange={(event) => setBidPayload({ amount: Number(event.target.value) })}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          className="primary-button button-moss"
                          onClick={() =>
                            runAction("Placing bid", () => api.placeBid(accessToken, selectedItemId, bidPayload), () => {
                              setReloadKey((current) => current + 1);
                            })
                          }
                        >
                          Place bid
                        </button>
                        <button
                          type="button"
                          className="primary-button button-ink"
                          onClick={() =>
                            runAction("Checking top bid", () => api.getHighestBid(accessToken, selectedItemId), (response) => {
                              setHighestBidText(response.raw);
                            })
                          }
                        >
                          View top bid
                        </button>
                        <button
                          type="button"
                          className="primary-button button-ember"
                          onClick={() =>
                            runAction("Removing bid", () => api.removeBid(accessToken, selectedItemId), () => {
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
                      Only buyer accounts can place or remove bids. Switch to a bidder account to join the auction.
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
}