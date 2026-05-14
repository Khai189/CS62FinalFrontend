"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { StatusBanner } from "@/components/status-banner";
import { useAuthSession } from "@/lib/auth-session";
import { api } from "@/lib/api";
import type { ActiveBidSummary } from "@/lib/types";

function activityMatchesSearch(item: ActiveBidSummary, query: string) {
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

export function ActivityView() {
  const { ready, currentUser, accessToken, isBidder, isAuctioneer } = useAuthSession();
  const [items, setItems] = useState<ActiveBidSummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [statusMessage, setStatusMessage] = useState(
    "Track your current bids and see where the top offer stands."
  );

  useEffect(() => {
    if (!accessToken || !currentUser) {
      setItems([]);
      return;
    }
    const token = accessToken;

    let cancelled = false;

    async function loadActivity() {
      const response = await api.getActiveBids(token);
      if (cancelled) {
        return;
      }

      if (response.ok && response.data) {
        setItems(response.data);
        setStatusTone("success");
        setStatusMessage(
          isAuctioneer
            ? "Your live listings are loaded with the current top bidder and bid amount."
            : "Your active bids are loaded with the current top bidder and bid amount."
        );
      } else {
        setItems([]);
        setStatusTone("error");
        setStatusMessage(response.raw || "We could not load your bid activity right now.");
      }
    }

    void loadActivity();
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentUser, isAuctioneer]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }
    return items.filter((item) => activityMatchesSearch(item, query));
  }, [items, search]);

  if (!ready) {
    return (
      <main className="px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-6xl">
          <StatusBanner title="Loading activity" body="Pulling in your current bidding activity." tone="neutral" />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {!currentUser || !accessToken ? (
          <SectionCard title="Bid Activity" subtitle="Sign In Required">
            <p className="text-sm leading-7 text-slate">
              Sign in from the marketplace to see the listings you are bidding on or the listings you posted.
            </p>
            <Link href="/" className="primary-button button-ink mt-5 inline-flex w-fit">
              Go to marketplace
            </Link>
          </SectionCard>
        ) : (
          <>
            <StatusBanner title="Activity Update" body={statusMessage} tone={statusTone} />

            <SectionCard
              title={isAuctioneer ? "Your Live Listings" : "Your Active Bids"}
              subtitle={isAuctioneer ? "Seller Activity" : "Buyer Activity"}
            >
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <label className="field-label">
                  Search activity
                  <input
                    className="field-input"
                    placeholder="Search by listing, seller, or highest bidder"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <div className="glass-tile px-5 py-4 text-sm text-slate">
                  <p className="section-eyebrow mb-2">Activity Snapshot</p>
                  <p>{filteredItems.length} tracked listing{filteredItems.length === 1 ? "" : "s"}</p>
                </div>
              </div>

              <div className="mt-6">
                {filteredItems.length === 0 ? (
                  <p className="rounded-[1.6rem] border border-dashed border-[color:var(--line-strong)] bg-white/55 p-5 text-sm leading-6 text-slate">
                    {search
                      ? "No tracked listings match that search yet."
                      : isAuctioneer
                        ? "You do not have any live listings yet. Post one from the marketplace to start collecting bids."
                        : "You do not have any active bids yet. Place a bid from the marketplace to see it here."}
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
                          {item.viewerIsHighestBidder ? (
                            <span className="rounded-full bg-moss px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white">
                              You lead
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-slate">
                            Start ${item.startingPrice ?? "N/A"}
                          </span>
                          <span className="rounded-full bg-ember/10 px-3 py-1 text-xs font-medium text-ember">
                            Highest ${item.highestBidAmount ?? "None yet"}
                          </span>
                          {item.viewerBidAmount != null ? (
                            <span className="rounded-full bg-tide/10 px-3 py-1 text-xs font-medium text-tide">
                              Your bid ${item.viewerBidAmount}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 grid gap-2 text-sm leading-6 text-slate">
                          <p>
                            Highest bidder: {item.highestBidderId ?? "No bids yet"}
                          </p>
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
