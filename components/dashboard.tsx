"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/section-card";
import { ItemGrid } from "@/components/item-grid";
import { StatusBanner } from "@/components/status-banner";
import { api } from "@/lib/api";
import type { ApiResponse, BidItem, Bidder, Credentials, ListItemPayload, PlaceBidPayload } from "@/lib/types";

const presetCredentials = {
  admin: { username: "admin", password: "admin" },
  bidder: { username: "bidder", password: "bidder" },
  auctioneer: { username: "auctioneer", password: "auctioneer" }
} satisfies Record<string, Credentials>;

function mergeBidders(current: Bidder[], incoming: Bidder[]) {
  const merged = new Map<string, Bidder>();
  for (const bidder of current) {
    merged.set(bidder.bidderId, bidder);
  }
  for (const bidder of incoming) {
    merged.set(bidder.bidderId, bidder);
  }
  return Array.from(merged.values()).sort((a, b) => a.bidderId.localeCompare(b.bidderId));
}

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

function toKnownItem(payload: ListItemPayload): BidItem {
  return {
    itemId: payload.itemId,
    itemName: payload.itemName,
    startingPrice: payload.startingPrice,
    description: null,
    auctioneer: {
      auctioneerId: payload.auctioneerId,
      name: payload.auctioneerName
    }
  };
}

function summarizeResponse(response: ApiResponse<unknown>) {
  if (response.data !== null) {
    return `Request finished with status ${response.status}.`;
  }
  return response.raw || `Request finished with status ${response.status}.`;
}

export function Dashboard() {
  const backendDisplayUrl = process.env.NEXT_PUBLIC_BACKEND_DISPLAY_URL ?? "http://localhost:8080";
  const [credentials, setCredentials] = useState<Credentials>(presetCredentials.bidder);
  const [bidders, setBidders] = useState<Bidder[]>([]);
  const [catalogItems, setCatalogItems] = useState<BidItem[]>([]);
  const [knownItems, setKnownItems] = useState<BidItem[]>([]);
  const [feedItems, setFeedItems] = useState<BidItem[]>([]);
  const [recommendedItems, setRecommendedItems] = useState<BidItem[]>([]);

  const [selectedBidderId, setSelectedBidderId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [lookupBidderId, setLookupBidderId] = useState("");
  const [totalRecs, setTotalRecs] = useState(4);

  const [bidderId, setBidderId] = useState("");
  const [bidderName, setBidderName] = useState("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | "">("");
  const [itemPayload, setItemPayload] = useState<ListItemPayload>({
    itemId: "",
    itemName: "",
    startingPrice: 0,
    auctioneerId: "",
    auctioneerName: ""
  });
  const [bidPayload, setBidPayload] = useState<PlaceBidPayload>({
    bidderId: "",
    amount: 0
  });
  const [highestBidText, setHighestBidText] = useState("");
  const [removeBidderId, setRemoveBidderId] = useState("");

  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [statusMessage, setStatusMessage] = useState("Connect to the backend and pick a bidder to load a personalized feed.");

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
      const firstItem = merged[0];
      if (firstItem) {
        setSelectedItemId((currentId) => currentId || firstItem.itemId);
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
    let cancelled = false;

    async function bootstrap() {
      const [bidderResponse, itemResponse] = await Promise.all([
        api.getAllBidders(credentials),
        api.getAllItems(credentials)
      ]);
      if (cancelled) {
        return;
      }

      if (bidderResponse.ok && bidderResponse.data) {
        rememberBidders(bidderResponse.data);
      }

      if (itemResponse.ok && itemResponse.data) {
        setCatalogItems(itemResponse.data);
        rememberItems(itemResponse.data);
      }

      if (bidderResponse.ok) {
        setStatusTone("neutral");
        setStatusMessage("Connected. Browse the marketplace, then pick a bidder to personalize the feed.");
      } else {
        setStatusTone("error");
        setStatusMessage(bidderResponse.raw || "Could not load bidders from the backend.");
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [credentials]);

  useEffect(() => {
    if (!selectedBidderId) {
      return;
    }

    let cancelled = false;

    async function loadFeed() {
      const response = await api.getFeed(credentials, selectedBidderId);
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
  }, [credentials, selectedBidderId]);

  useEffect(() => {
    if (!selectedBidderId || !selectedItemId) {
      return;
    }

    let cancelled = false;

    async function loadRecommendations() {
      const response = await api.getRecommendations(credentials, selectedBidderId, selectedItemId, totalRecs);
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
  }, [credentials, selectedBidderId, selectedItemId, totalRecs]);

  function handleSelectItem(item: BidItem) {
    setSelectedItemId(item.itemId);
  }

  function handleSelectBidder(bidderIdValue: string) {
    setSelectedBidderId(bidderIdValue);
    setLookupBidderId(bidderIdValue);
    setBidPayload((current) => ({ ...current, bidderId: bidderIdValue }));
    setRemoveBidderId(bidderIdValue);
  }

  return (
    <main className="px-4 py-8 md:px-8 md:py-10">
      <datalist id="bidder-id-options">
        {bidders.map((bidder) => (
          <option key={bidder.bidderId} value={bidder.bidderId}>
            {bidder.name ?? bidder.bidderId}
          </option>
        ))}
      </datalist>
      <datalist id="item-id-options">
        {knownItems.map((item) => (
          <option key={item.itemId} value={item.itemId}>
            {item.itemName ?? item.itemId}
          </option>
        ))}
      </datalist>

      <div className="mx-auto max-w-7xl">
        <div className="mb-8 overflow-hidden rounded-[2.5rem] border border-white/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(255,245,228,0.84))] p-8 shadow-card">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-ember">
            5CBid
          </p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl text-ink md:text-6xl">A bidding site with a personalized feed</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate md:text-lg">
                Browse items, follow recommendations tied to your bidding history, list items for sale,
                and place bids through the existing Spring backend.
              </p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/70 px-5 py-4 text-sm text-slate">
              <p>Signed in as: {authSummary}</p>
              <p>Viewing bidder: {selectedBidderId || "None yet"}</p>
              <p>{loadingLabel ? `Working: ${loadingLabel}` : "Ready"}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <StatusBanner title="Site Status" body={statusMessage} tone={statusTone} />

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard title="Your Session" subtitle="Identity">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-3">
                  <p className="text-sm text-slate">Choose a backend role:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                      onClick={() => setCredentials(presetCredentials.admin)}
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-tide px-4 py-2 text-sm font-semibold text-white"
                      onClick={() => setCredentials(presetCredentials.auctioneer)}
                    >
                      Auctioneer
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white"
                      onClick={() => setCredentials(presetCredentials.bidder)}
                    >
                      Bidder
                    </button>
                  </div>
                </div>
                <label className="grid gap-2 text-sm text-slate">
                  Active bidder ID
                  <input
                    className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                    list="bidder-id-options"
                    value={selectedBidderId}
                    onChange={(event) => handleSelectBidder(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate">
                  Username
                  <input
                    className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                    value={credentials.username}
                    onChange={(event) =>
                      setCredentials((current) => ({ ...current, username: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate">
                  Password
                  <input
                    className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                    type="password"
                    value={credentials.password}
                    onChange={(event) =>
                      setCredentials((current) => ({ ...current, password: event.target.value }))
                    }
                  />
                </label>
              </div>
            </SectionCard>

            <SectionCard title="Bidder Setup" subtitle="Accounts">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm text-slate">
                    Lookup bidder
                    <input
                      className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                      list="bidder-id-options"
                      value={lookupBidderId}
                      onChange={(event) => setLookupBidderId(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="w-fit rounded-full bg-tide px-4 py-2 text-sm font-semibold text-white"
                    onClick={() =>
                      runAction("Load bidder", () => api.getBidder(credentials, lookupBidderId), (response) => {
                        if (response.data) {
                          rememberBidders([response.data]);
                          handleSelectBidder(response.data.bidderId);
                        }
                      })
                    }
                  >
                    Load bidder
                  </button>
                </div>
                <div className="grid gap-3">
                  <label className="grid gap-2 text-sm text-slate">
                    New bidder ID
                    <input
                      className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                      value={bidderId}
                      onChange={(event) => setBidderId(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate">
                    Display name
                    <input
                      className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                      value={bidderName}
                      onChange={(event) => setBidderName(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="w-fit rounded-full bg-ember px-4 py-2 text-sm font-semibold text-white"
                    onClick={() =>
                      runAction("Create bidder", () => api.addBidder(credentials, bidderId, bidderName), (response) => {
                        if (response.ok && bidderId) {
                          rememberBidders([{ bidderId, name: bidderName || null }]);
                          handleSelectBidder(bidderId);
                          setBidderId("");
                          setBidderName("");
                        }
                      })
                    }
                  >
                    Create bidder
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

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
                emptyMessage="This bidder does not have any feed items yet."
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
                  emptyMessage="Choose a bidder and an item to load recommendations."
                  onSelect={handleSelectItem}
                />
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard title="Sell an Item" subtitle="Auctioneer">
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
                <input
                  className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                  placeholder="Auctioneer ID"
                  value={itemPayload.auctioneerId}
                  onChange={(event) =>
                    setItemPayload((current) => ({ ...current, auctioneerId: event.target.value }))
                  }
                />
                <input
                  className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                  placeholder="Auctioneer name"
                  value={itemPayload.auctioneerName}
                  onChange={(event) =>
                    setItemPayload((current) => ({ ...current, auctioneerName: event.target.value }))
                  }
                />
              </div>
              <button
                type="button"
                className="mt-4 rounded-full bg-tide px-4 py-2 text-sm font-semibold text-white"
                onClick={() =>
                  runAction("List item", () => api.listItem(credentials, itemPayload), (response) => {
                    if (response.ok && itemPayload.itemId) {
                      const item = toKnownItem(itemPayload);
                      setCatalogItems((current) => mergeItems(current, [item]));
                      rememberItems([item]);
                      setSelectedItemId(item.itemId);
                    }
                  })
                }
              >
                List item
              </button>
            </SectionCard>

            <SectionCard title="Bid on an Item" subtitle="Bidder">
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
                  list="bidder-id-options"
                  placeholder="Bidder ID"
                  value={bidPayload.bidderId}
                  onChange={(event) =>
                    setBidPayload((current) => ({ ...current, bidderId: event.target.value }))
                  }
                />
                <input
                  className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                  placeholder="Bid amount"
                  type="number"
                  value={bidPayload.amount}
                  onChange={(event) =>
                    setBidPayload((current) => ({
                      ...current,
                      amount: Number(event.target.value)
                    }))
                  }
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => runAction("Place bid", () => api.placeBid(credentials, selectedItemId, bidPayload))}
                >
                  Place bid
                </button>
                <button
                  type="button"
                  className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white"
                  onClick={() =>
                    runAction("Check highest bid", () => api.getHighestBid(credentials, selectedItemId), (response) => {
                      setHighestBidText(response.raw);
                    })
                  }
                >
                  Check highest bid
                </button>
              </div>
              {highestBidText ? (
                <p className="mt-4 rounded-3xl border border-[color:var(--line)] bg-white/70 px-4 py-3 text-sm text-slate">
                  {highestBidText}
                </p>
              ) : null}
            </SectionCard>
          </div>

          <SectionCard title="Manage a Bid" subtitle="Cleanup">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                list="item-id-options"
                placeholder="Item ID"
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
              />
              <input
                className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3 text-ink"
                list="bidder-id-options"
                placeholder="Bidder ID"
                value={removeBidderId}
                onChange={(event) => setRemoveBidderId(event.target.value)}
              />
              <button
                type="button"
                className="rounded-full bg-ember px-4 py-2 text-sm font-semibold text-white"
                onClick={() =>
                  runAction("Remove bid", () => api.removeBid(credentials, selectedItemId, removeBidderId))
                }
              >
                Remove bid
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
