"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/section-card";
import { StatusBanner } from "@/components/status-banner";
import { useAuthSession } from "@/lib/auth-session";
import { api } from "@/lib/api";
import type { BidHistorySummary } from "@/lib/types";

/**
 * Formats a historical item's condition string for display.
 * 
 * * @param {BidHistorySummary["condition"]} condition - the raw condition string
 * @returns {string} the condition with underscores replaced by spaces, or a fallback string
 */
function conditionLabel(condition: BidHistorySummary["condition"]) {
  return condition ? condition.replaceAll("_", " ") : "Condition unavailable";
}

/**
 * Checks if a specific history record matches the user's search query.
 * 
 * * @param {BidHistorySummary} item - the historical bid record to evaluate
 * @param {string} query - the search query (expected to be lowercase)
 * @returns {boolean} true if a match is found in the ID, name, description, seller, or bidder fields
 */
function historyMatchesSearch(item: BidHistorySummary, query: string) {
  const haystack = [
    item.itemId,
    item.itemName,
    item.description,
    item.auctioneerName,
    item.auctioneerId,
    item.highestBidderId
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

/**
 * Converts a date string into a localized, readable format.
 * 
 * * @param {string | null} value - the date string to format
 * @returns {string} the localized date and time, or "Unknown" if the input is invalid or null
 */
function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * Renders the user's personal history page for the marketplace.
 * 
 * * @returns {JSX.Element} the rendered HistoryView component
 */
export function HistoryView() {
  const { ready, currentUser, accessToken, isAuctioneer } = useAuthSession();
  const [items, setItems] = useState<BidHistorySummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [statusMessage, setStatusMessage] = useState(
    "Browse your past bids or archived auctions."
  );

  useEffect(() => {
    if (!accessToken || !currentUser) {
      setItems([]);
      return;
    }
    const token = accessToken;

    let cancelled = false;

    async function loadHistory() {
      const response = await api.getBidHistory(token);
      if (cancelled) {
        return;
      }

      if (response.ok && response.data) {
        setItems(response.data);
        setStatusTone("success");
        setStatusMessage(
          isAuctioneer
            ? "Your archived auctions are loaded with their past bid history."
            : "Your past bids are loaded with the final highest bid on each listing."
        );
      } else {
        setItems([]);
        setStatusTone("error");
        setStatusMessage(response.raw || "We could not load your history right now.");
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentUser, isAuctioneer]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => historyMatchesSearch(item, query));
  }, [items, search]);

  if (!ready) {
    return (
      <main className="px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-6xl">
          <StatusBanner title="Loading history" body="Pulling in your past marketplace activity." tone="neutral" />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {!currentUser || !accessToken ? (
          <SectionCard title="Marketplace History" subtitle="Sign In Required">
            <p className="text-sm leading-7 text-slate">
              Sign in from the marketplace to see your previous bids or past auctions.
            </p>
            <Link href="/" className="primary-button button-ink mt-5 inline-flex w-fit">
              Go to marketplace
            </Link>
          </SectionCard>
        ) : (
          <>
            <StatusBanner title="History Update" body={statusMessage} tone={statusTone} />

            <SectionCard
              title={isAuctioneer ? "Past Auctions" : "Past Bids"}
              subtitle={isAuctioneer ? "Seller History" : "Buyer History"}
            >
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <label className="field-label">
                  Search history
                  <input
                    className="field-input"
                    placeholder="Search by listing, seller, or winner"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <div className="glass-tile px-5 py-4 text-sm text-slate">
                  <p className="section-eyebrow mb-2">History Snapshot</p>
                  <p>{filteredItems.length} archived listing{filteredItems.length === 1 ? "" : "s"}</p>
                </div>
              </div>

              <div className="mt-6">
                {filteredItems.length === 0 ? (
                  <p className="rounded-[1.6rem] border border-dashed border-[color:var(--line-strong)] bg-white/55 p-5 text-sm leading-6 text-slate">
                    {search
                      ? "No history entries match that search yet."
                      : isAuctioneer
                        ? "You do not have any archived auctions yet."
                        : "You do not have any past bids yet."}
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredItems.map((item) => (
                      <article key={item.itemId} className="glass-tile px-5 py-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="section-eyebrow mb-2">
                              {item.auctioneerName ?? item.auctioneerId ?? "Unknown seller"}
                            </p>
                            <h2 className="text-2xl text-ink">{item.itemName || "Untitled listing"}</h2>
                          </div>
                          <span className="rounded-full bg-ink/5 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate">
                            Archived
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-slate">
                            Start ${item.startingPrice ?? "N/A"}
                          </span>
                          <span className="rounded-full bg-tide/10 px-3 py-1 text-xs font-medium text-tide">
                            {conditionLabel(item.condition)}
                          </span>
                          <span className="rounded-full bg-ember/10 px-3 py-1 text-xs font-medium text-ember">
                            Final high ${item.highestBidAmount ?? "None"}
                          </span>
                          {item.viewerBidAmount != null ? (
                            <span className="rounded-full bg-tide/10 px-3 py-1 text-xs font-medium text-tide">
                              Your top bid ${item.viewerBidAmount}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 grid gap-2 text-sm leading-6 text-slate">
                          <p>Winning bidder: {item.highestBidderId ?? "No bids recorded"}</p>
                          <p>Total bids: {item.totalBidCount ?? 0}</p>
                          <p>Last bid: {formatDate(item.lastBidAt)}</p>
                          <p>{item.description || "No description added for this listing yet."}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </main>
  );
}
