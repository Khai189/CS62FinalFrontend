"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/section-card";
import { StatusBanner } from "@/components/status-banner";
import { useAuthSession } from "@/lib/auth-session";
import { api } from "@/lib/api";
import type { BidHistorySummary } from "@/lib/types";

function conditionLabel(condition: BidHistorySummary["condition"]) {
  return condition ? condition.replaceAll("_", " ") : "Condition unavailable";
}

function expiredMatchesSearch(item: BidHistorySummary, query: string) {
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

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function outcomeLabel(item: BidHistorySummary) {
  if (item.highestBidderId && item.highestBidAmount != null) {
    return `Won by ${item.highestBidderId} for $${item.highestBidAmount}`;
  }
  return "Closed without a winning bid";
}

export function ExpiredView() {
  const { ready, currentUser, accessToken } = useAuthSession();
  const [items, setItems] = useState<BidHistorySummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [statusMessage, setStatusMessage] = useState(
    "Browse past campus listings and see how each auction ended."
  );

  useEffect(() => {
    if (!accessToken || !currentUser) {
      setItems([]);
      return;
    }
    const token = accessToken;

    let cancelled = false;

    async function loadExpired() {
      const response = await api.getExpiredBids(token);
      if (cancelled) {
        return;
      }

      if (response.ok && response.data) {
        setItems(response.data);
        setStatusTone("success");
        setStatusMessage("Expired marketplace results are loaded with each listing's final outcome.");
      } else {
        setItems([]);
        setStatusTone("error");
        setStatusMessage(response.raw || "We could not load expired marketplace results right now.");
      }
    }

    void loadExpired();
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentUser]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => expiredMatchesSearch(item, query));
  }, [items, search]);

  if (!ready) {
    return (
      <main className="px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-6xl">
          <StatusBanner title="Loading expired listings" body="Pulling in closed marketplace results." tone="neutral" />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {!currentUser || !accessToken ? (
          <SectionCard title="Expired Listings" subtitle="Sign In Required">
            <p className="text-sm leading-7 text-slate">
              Sign in from the marketplace to browse expired listings and their final outcomes.
            </p>
            <Link href="/" className="primary-button button-ink mt-5 inline-flex w-fit">
              Go to marketplace
            </Link>
          </SectionCard>
        ) : (
          <>
            <StatusBanner title="Expired Marketplace Results" body={statusMessage} tone={statusTone} />

            <SectionCard title="Closed Listings" subtitle="Expired Marketplace">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <label className="field-label">
                  Search expired listings
                  <input
                    className="field-input"
                    placeholder="Search by listing, seller, or winner"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <div className="glass-tile px-5 py-4 text-sm text-slate">
                  <p className="section-eyebrow mb-2">Expired Snapshot</p>
                  <p>{filteredItems.length} closed listing{filteredItems.length === 1 ? "" : "s"}</p>
                </div>
              </div>

              <div className="mt-6">
                {filteredItems.length === 0 ? (
                  <p className="rounded-[1.6rem] border border-dashed border-[color:var(--line-strong)] bg-white/55 p-5 text-sm leading-6 text-slate">
                    {search
                      ? "No expired listings match that search yet."
                      : "No expired listings are available right now."}
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
                            <h2 className="text-2xl text-ink">{item.itemName || item.itemId}</h2>
                            <p className="mt-1 text-sm text-slate">{item.itemId}</p>
                          </div>
                          <span className="rounded-full bg-ink/5 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate">
                            Expired
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
                            Final ${item.highestBidAmount ?? "No sale"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm leading-6 text-slate">
                          <p>{outcomeLabel(item)}</p>
                          <p>Total bids: {item.totalBidCount ?? 0}</p>
                          <p>Closed after last bid: {formatDate(item.lastBidAt)}</p>
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
