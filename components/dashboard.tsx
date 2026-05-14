"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ItemGrid } from "@/components/item-grid";
import { SectionCard } from "@/components/section-card";
import { StatusBanner } from "@/components/status-banner";
import { useAuthSession } from "@/lib/auth-session";
import { api } from "@/lib/api";
import type {
  ApiResponse,
  AuthUser,
  BidItem,
  Credentials,
  ItemCondition,
  ItemSearchFilters,
  ListingDurationUnit,
  ListedItemResponse,
  ListItemPayload,
  RegisterPayload
} from "@/lib/types";

type CatalogFilterForm = {
  query: string;
  auctioneerId: string;
  minPrice: string;
  maxPrice: string;
  condition: "" | ItemCondition;
};

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
  if (
    response.data &&
    typeof response.data === "object" &&
    "message" in response.data &&
    typeof response.data.message === "string"
  ) {
    return response.data.message;
  }
  return response.raw || `Request finished with status ${response.status}.`;
}

function toKnownItem(payload: ListItemPayload, response: ListedItemResponse, user: AuthUser): BidItem {
  return {
    itemId: response.itemId,
    itemName: payload.itemName,
    startingPrice: payload.startingPrice,
    description: payload.description || null,
    condition: payload.condition,
    expiresAt: response.expiresAt,
    auctioneer: {
      auctioneerId: user.profileId ?? user.username,
      name: user.displayName
    }
  };
}

function parseNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function Dashboard() {
  const { ready, currentUser, accessToken, saveSession, signOut, isBidder, isAuctioneer, activeBidderId } =
    useAuthSession();
  const router = useRouter();

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

  const [catalogFilterForm, setCatalogFilterForm] = useState<CatalogFilterForm>({
    query: "",
    auctioneerId: "",
    minPrice: "",
    maxPrice: "",
    condition: ""
  });
  const [catalogFilters, setCatalogFilters] = useState<ItemSearchFilters>({});
  const [selectedItemId, setSelectedItemId] = useState("");
  const [feedSearch, setFeedSearch] = useState("");
  const [totalRecs, setTotalRecs] = useState(4);
  const [itemPayload, setItemPayload] = useState<ListItemPayload>({
    itemName: "",
    startingPrice: 0.5,
    description: "",
    condition: "NEW",
    durationAmount: 1,
    durationUnit: "DAYS"
  });
  const [itemPriceInput, setItemPriceInput] = useState("");
  const [listingDurationInput, setListingDurationInput] = useState("1");
  const [reloadKey, setReloadKey] = useState(0);

  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [statusMessage, setStatusMessage] = useState(
    "Create an account to browse live student listings, place bids, or post something of your own."
  );

  const authSummary = useMemo(() => {
    if (!accessToken) {
      return "Guest browsing mode";
    }
    return "Signed in and ready to trade";
  }, [accessToken]);

  const hasCatalogFilters = useMemo(() => {
    return Boolean(
      catalogFilters.query ||
        catalogFilters.auctioneerId ||
        catalogFilters.minPrice != null ||
        catalogFilters.maxPrice != null ||
        catalogFilters.condition
    );
  }, [catalogFilters]);

  const parsedListingPrice = useMemo(() => parseNumber(itemPriceInput), [itemPriceInput]);
  const listingPriceError = useMemo(() => {
    if (!itemPriceInput.trim()) {
      return null;
    }
    if (parsedListingPrice == null || parsedListingPrice < 0.5) {
      return "Price must be equal to or above 50 cents";
    }
    return null;
  }, [itemPriceInput, parsedListingPrice]);

  const maxPriceFilterError = useMemo(() => {
    if (!catalogFilterForm.maxPrice.trim()) {
      return null;
    }
    const parsed = parseNumber(catalogFilterForm.maxPrice);
    if (parsed == null || parsed < 0.5) {
      return "Maximum opening bid must be at least 50 cents";
    }
    return null;
  }, [catalogFilterForm.maxPrice]);

  const parsedDurationAmount = useMemo(() => {
    if (!listingDurationInput.trim()) {
      return undefined;
    }
    const parsed = Number(listingDurationInput);
    return Number.isInteger(parsed) ? parsed : undefined;
  }, [listingDurationInput]);

  const listingDurationError = useMemo(() => {
    if (!listingDurationInput.trim()) {
      return "Listing duration must be 1 or greater";
    }
    if (parsedDurationAmount == null || parsedDurationAmount < 1) {
      return "Listing duration must be 1 or greater";
    }
    return null;
  }, [listingDurationInput, parsedDurationAmount]);

  function clearSessionState() {
    signOut();
    setCatalogItems([]);
    setKnownItems([]);
    setFeedItems([]);
    setRecommendedItems([]);
    setSelectedItemId("");
    setItemPriceInput("");
    setListingDurationInput("1");
    setFeedSearch("");
    setCatalogFilterForm({
      query: "",
      auctioneerId: "",
      minPrice: "",
      maxPrice: "",
      condition: ""
    });
    setCatalogFilters({});
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
    if (!accessToken || !currentUser) {
      setCatalogItems([]);
      return;
    }
    const token = accessToken;

    let cancelled = false;

    async function loadCatalog() {
      const response = await api.getAllItems(token, catalogFilters);
      if (cancelled) {
        return;
      }

      if (response.ok && response.data) {
        setCatalogItems(response.data);
        rememberItems(response.data);
        setStatusTone("neutral");
        setStatusMessage(
          hasCatalogFilters
            ? "Marketplace filters are active. Refine them any time to narrow down the listings."
            : "Browse open listings, jump into a bidding war, or post your own item for sale."
        );
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
  }, [accessToken, currentUser, catalogFilters, hasCatalogFilters, reloadKey]);

  useEffect(() => {
    if (!accessToken || !currentUser || !activeBidderId) {
      setFeedItems([]);
      setRecommendedItems([]);
      setFeedSearch("");
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

  const filteredFeedItems = useMemo(() => {
    const query = feedSearch.trim().toLowerCase();
    if (!query) {
      return feedItems;
    }

    return feedItems.filter((item) => {
      const haystack = [
        item.itemId,
        item.itemName,
        item.description,
        item.auctioneer?.name,
        item.auctioneer?.auctioneerId
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [feedItems, feedSearch]);

  function handleSelectItem(item: BidItem) {
    setSelectedItemId(item.itemId);
    if (isBidder) {
      router.push(`/listings/${encodeURIComponent(item.itemId)}`);
    }
  }

  function listingOptionLabel(item: BidItem) {
    const seller = item.auctioneer?.name ?? item.auctioneer?.auctioneerId ?? "Unknown seller";
    return `${item.itemName || "Untitled listing"} · ${seller}`;
  }

  function applyCatalogFilters() {
    if (maxPriceFilterError) {
      setStatusTone("error");
      setStatusMessage(maxPriceFilterError);
      return;
    }

    setCatalogFilters({
      query: catalogFilterForm.query.trim() || undefined,
      auctioneerId: catalogFilterForm.auctioneerId.trim() || undefined,
      minPrice: parseNumber(catalogFilterForm.minPrice),
      maxPrice: parseNumber(catalogFilterForm.maxPrice),
      condition: catalogFilterForm.condition || undefined
    });
  }

  function clearCatalogFilters() {
    setCatalogFilterForm({
      query: "",
      auctioneerId: "",
      minPrice: "",
      maxPrice: "",
      condition: ""
    });
    setCatalogFilters({});
  }

  function submitListing() {
    if (!accessToken) {
      setStatusTone("error");
      setStatusMessage("Sign in again before posting a listing.");
      return;
    }
    if (parsedListingPrice == null || parsedListingPrice < 0.5) {
      setStatusTone("error");
      setStatusMessage("Price must be equal to or above 50 cents");
      return;
    }
    if (parsedDurationAmount == null || parsedDurationAmount < 1) {
      setStatusTone("error");
      setStatusMessage("Listing duration must be 1 or greater");
      return;
    }

    const payload: ListItemPayload = {
      ...itemPayload,
      startingPrice: parsedListingPrice,
      durationAmount: parsedDurationAmount
    };

    void runAction("Posting listing", () => api.listItem(accessToken, payload), (response) => {
      if (!response.ok || !currentUser || !response.data) {
        return;
      }
      const item = toKnownItem(payload, response.data, currentUser);
      setCatalogItems((current) => mergeItems(current, [item]));
      rememberItems([item]);
      setSelectedItemId(item.itemId);
      setItemPayload({
        itemName: "",
        startingPrice: 0.5,
        description: "",
        condition: "NEW",
        durationAmount: 1,
        durationUnit: "DAYS"
      });
      setItemPriceInput("");
      setListingDurationInput("1");
      setReloadKey((current) => current + 1);
    });
  }

  if (!ready) {
    return (
      <main className="px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-7xl">
          <StatusBanner
            title="Loading marketplace"
            body="Pulling up your account and the latest campus listings."
            tone="neutral"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="surface-panel relative mb-8 overflow-hidden p-8 md:p-10">
          <div className="absolute inset-y-0 right-0 hidden w-80 bg-[radial-gradient(circle_at_top,rgba(47,111,115,0.18),transparent_58%)] lg:block" />
          <p className="section-eyebrow text-ember">5CBid</p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="max-w-4xl text-4xl text-ink md:text-6xl">
                The One and Only 5C Bidding Auction: Sell Your Stuff and Get Real Money
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate md:text-lg">
                5CBid is a campus marketplace for auction-style listings, where students at the Claremont Colleges can post items,
                place bids, search the market, and get suggestions based on previous interests.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="hero-chip">Student listings</span>
                <span className="hero-chip">Live bids</span>
                <span className="hero-chip">Personalized suggestions</span>
              </div>
            </div>
            <div className="glass-tile max-w-sm px-5 py-4 text-sm text-slate">
              <p className="section-eyebrow mb-3">Today On 5CBid</p>
              <div className="grid gap-2">
                <p>{authSummary}</p>
                <p>
                  {currentUser
                    ? `${currentUser.displayName} is signed in as ${currentUser.role.toLowerCase()}`
                    : "Sign in to bid, list items, and build your personalized feed"}
                </p>
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
                        saveSession(response.data);
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
                          saveSession(response.data);
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
              <SectionCard title={`Welcome Back, ${currentUser.displayName}`} subtitle="Marketplace Home">
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="grid gap-2 text-sm text-slate">
                    <p>You are browsing as a {currentUser.role.toLowerCase()}.</p>
                    <p>Use the navigation bar to move between the marketplace, activity, and your profile.</p>
                    <p>
                      {isBidder
                        ? "Your feed and recommendations update based on what you explore and bid on."
                        : "Your seller tools are ready below so you can post new campus listings."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/activity" className="primary-button button-moss inline-flex w-fit">
                      View activity
                    </Link>
                    <Link href="/profile" className="primary-button button-tide inline-flex w-fit">
                      View profile
                    </Link>
                    <button
                      type="button"
                      className="primary-button button-ember w-fit"
                      onClick={() => {
                        clearSessionState();
                        setStatusTone("neutral");
                        setStatusMessage("You signed out. Come back when you are ready to browse again.");
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Find Listings" subtitle="Search And Filter">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <label className="field-label">
                    Search listings
                    <input
                      className="field-input"
                      placeholder="Name, seller, or description"
                      value={catalogFilterForm.query}
                      onChange={(event) =>
                        setCatalogFilterForm((current) => ({ ...current, query: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field-label">
                    Seller ID
                    <input
                      className="field-input"
                      placeholder="auctioneer username"
                      value={catalogFilterForm.auctioneerId}
                      onChange={(event) =>
                        setCatalogFilterForm((current) => ({
                          ...current,
                          auctioneerId: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="field-label">
                    Min opening bid
                    <input
                      className="field-input"
                      type="number"
                      min={0}
                      value={catalogFilterForm.minPrice}
                      onChange={(event) =>
                        setCatalogFilterForm((current) => ({ ...current, minPrice: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field-label">
                    Max opening bid
                    <input
                      className="field-input"
                      type="number"
                      min={0.5}
                      step={0.01}
                      value={catalogFilterForm.maxPrice}
                      onChange={(event) =>
                        setCatalogFilterForm((current) => ({ ...current, maxPrice: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field-label">
                    Condition
                    <select
                      className="field-input"
                      value={catalogFilterForm.condition}
                      onChange={(event) =>
                        setCatalogFilterForm((current) => ({
                          ...current,
                          condition: event.target.value as CatalogFilterForm["condition"]
                        }))
                      }
                    >
                      <option value="">Any condition</option>
                      <option value="NEW">New</option>
                      <option value="USED">Used</option>
                      <option value="HIGHLY_DAMAGED">Highly damaged</option>
                    </select>
                  </label>
                </div>
                {maxPriceFilterError ? (
                  <p className="mt-3 text-sm font-medium text-red-600">{maxPriceFilterError}</p>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" className="primary-button button-ink" onClick={applyCatalogFilters}>
                    Apply filters
                  </button>
                  <button type="button" className="primary-button button-tide" onClick={clearCatalogFilters}>
                    Clear filters
                  </button>
                </div>
              </SectionCard>

              <ItemGrid
                title="Open Listings"
                subtitle={hasCatalogFilters ? "Filtered Marketplace" : "Campus Marketplace"}
                items={catalogItems}
                selectedItemId={selectedItemId}
                showBidStats
                emptyMessage={
                  hasCatalogFilters
                    ? "No listings match those filters right now. Try widening your search."
                    : "No listings are live yet. A seller can post the first item."
                }
                onSelect={handleSelectItem}
              />

              {isBidder ? (
                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <SectionCard title="Picked For You" subtitle="Your Feed">
                    <div className="grid gap-4">
                      <label className="field-label">
                        Search your feed
                        <input
                          className="field-input"
                          placeholder="Search by listing name, seller, or description"
                          value={feedSearch}
                          onChange={(event) => setFeedSearch(event.target.value)}
                        />
                      </label>

                      <ItemGrid
                        title="Feed Results"
                        subtitle={feedSearch ? "Filtered Listings" : "Fresh Listings"}
                        items={filteredFeedItems}
                        selectedItemId={selectedItemId}
                        emptyMessage={
                          feedSearch
                            ? "No listings in your feed match that search yet."
                            : "Your feed is quiet right now. Bid on a few items and this section will learn your taste."
                        }
                        onSelect={handleSelectItem}
                      />
                    </div>
                  </SectionCard>

                  <SectionCard title="You Might Also Like" subtitle="Recommendations">
                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                      <label className="field-label">
                        Start from this listing
                        <select
                          className="field-input"
                          value={selectedItemId}
                          onChange={(event) => setSelectedItemId(event.target.value)}
                        >
                          <option value="">Choose a listing</option>
                          {knownItems.map((item) => (
                            <option key={item.itemId} value={item.itemId}>
                              {listingOptionLabel(item)}
                            </option>
                          ))}
                        </select>
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
              ) : null}

              {isAuctioneer ? (
                <SectionCard title="Post A Listing" subtitle="Seller Tools">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                      type="number"
                      min={0.5}
                      step={0.01}
                      placeholder="Price ($)"
                      value={itemPriceInput}
                      onChange={(event) => setItemPriceInput(event.target.value)}
                    />
                    <select
                      className="field-input"
                      value={itemPayload.condition}
                      onChange={(event) =>
                        setItemPayload((current) => ({
                          ...current,
                          condition: event.target.value as ItemCondition
                        }))
                      }
                    >
                      <option value="NEW">New</option>
                      <option value="USED">Used</option>
                      <option value="HIGHLY_DAMAGED">Highly Damaged</option>
                    </select>
                    <input
                      className="field-input"
                      type="number"
                      min={1}
                      step={1}
                      placeholder="Active for"
                      value={listingDurationInput}
                      onChange={(event) => setListingDurationInput(event.target.value)}
                    />
                    <select
                      className="field-input"
                      value={itemPayload.durationUnit}
                      onChange={(event) =>
                        setItemPayload((current) => ({
                          ...current,
                          durationUnit: event.target.value as ListingDurationUnit
                        }))
                      }
                    >
                      <option value="HOURS">Hours</option>
                      <option value="DAYS">Days</option>
                      <option value="WEEKS">Weeks</option>
                      <option value="MONTHS">Months</option>
                    </select>
                  </div>
                  {listingPriceError ? (
                    <p className="mt-2 text-sm font-medium text-red-600">{listingPriceError}</p>
                  ) : null}
                  {listingDurationError ? (
                    <p className="mt-2 text-sm font-medium text-red-600">{listingDurationError}</p>
                  ) : null}
                  <label className="field-label mt-3">
                    Description
                    <textarea
                      className="field-input min-h-32 resize-y"
                      placeholder="Tell buyers what the item is, what condition it is in, and anything they should know."
                      value={itemPayload.description}
                      onChange={(event) =>
                        setItemPayload((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="primary-button button-tide mt-4"
                    onClick={submitListing}
                  >
                    Post listing
                  </button>
                </SectionCard>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
