"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { SectionCard } from "@/components/section-card";
import { StatusBanner } from "@/components/status-banner";
import { useAuthSession } from "@/lib/auth-session";
import { api } from "@/lib/api";
import type { BidItem } from "@/lib/types";

/**
 * Formats a bid item's condition string for display.
 * 
 * * @param {BidItem["condition"]} condition - the raw condition string from the item
 * @returns {string} the condition with underscores replaced by spaces, or a fallback string
 */
function conditionLabel(condition: BidItem["condition"]) {
  return condition ? condition.replaceAll("_", " ") : "Condition unavailable";
}

/**
 * Parses a raw string from the highest bid API to extract the amount and bidder ID.
 *
 * * @param {string} raw - the raw string response from the backend
 * @returns {Object} an object containing the parsed highestBidAmount and highestBidderId
 */
function parseHighestBid(raw: string) {
  const amountMatch = raw.match(/@\s*(\d+)/);
  const bidderMatch = raw.match(/:\s*(.+?)\s*@/);

  if (!amountMatch) {
    return { highestBidAmount: null as number | null, highestBidderId: null as string | null };
  }

  return {
    highestBidAmount: Number(amountMatch[1]),
    highestBidderId: bidderMatch?.[1] ?? null
  };
}

function formatTimeRemaining(expiresAt: string | null | undefined, now: number) {
  if (!expiresAt) {
    return "Time remaining unavailable";
  }
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) {
    return "Time remaining unavailable";
  }
  const diff = target - now;
  if (diff <= 0) {
    return "Expired";
  }
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m left`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s left`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s left`;
  }
  return `${seconds}s left`;
}

type ListingDetailViewProps = {
  itemId: string;
};

/**
 * Renders the detailed view for a single auction listing.
 * 
 * * @param {ListingDetailViewProps} props - the component props
 * @param {string} props.itemId - the unique identifier for the listing to display
 * @returns {JSX.Element} the rendered ListingDetailView component
 */
export function ListingDetailView({ itemId }: ListingDetailViewProps) {
  const router = useRouter();
  const { ready, currentUser, accessToken, isBidder } = useAuthSession();
  const [item, setItem] = useState<BidItem | null>(null);
  const [highestBidAmount, setHighestBidAmount] = useState<number | null>(null);
  const [highestBidderId, setHighestBidderId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");
  const [statusMessage, setStatusMessage] = useState(
    "Check the current top bid, then place a stronger offer from this listing page."
  );

  useEffect(() => {
    if (!accessToken || !currentUser) {
      setItem(null);
      return;
    }
    const token = accessToken;
    const user = currentUser;

    let cancelled = false;

    async function loadListing() {
      setLoadingLabel("Loading listing");
      try {
        const [itemResponse, highestResponse] = await Promise.all([
          api.getItem(token, itemId),
          api.getHighestBid(token, itemId)
        ]);

        if (cancelled) {
          return;
        }

        if (itemResponse.ok && itemResponse.data) {
          setItem(itemResponse.data);
        } else {
          setItem(null);
          setStatusTone("error");
          setStatusMessage(itemResponse.raw || "We could not load this listing.");
          return;
        }

        if (highestResponse.ok) {
          const parsed = parseHighestBid(highestResponse.raw);
          setHighestBidAmount(parsed.highestBidAmount);
          setHighestBidderId(parsed.highestBidderId);
          setStatusTone("neutral");
          setStatusMessage(
            parsed.highestBidAmount != null
              ? "This listing is live. Place a bid high enough to overtake the current leader."
              : "No bids yet. You can open the bidding from this page."
          );
        } else {
          setHighestBidAmount(null);
          setHighestBidderId(null);
          setStatusTone("error");
          setStatusMessage(highestResponse.raw || "We could not load the current top bid.");
        }
      } catch (error) {
        if (!cancelled) {
          setStatusTone("error");
          setStatusMessage(error instanceof Error ? error.message : "Unknown network error.");
        }
      } finally {
        if (!cancelled) {
          setLoadingLabel(null);
        }
      }
    }

    void loadListing();
    return () => {
      cancelled = true;
    };
  }, [accessToken, currentUser, itemId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const referenceBid = useMemo(() => {
    if (highestBidAmount != null) {
      return highestBidAmount;
    }
    return item?.startingPrice != null ? Math.max(item.startingPrice, 0.5) : 0.5;
  }, [highestBidAmount, item]);

  const minimumBid = useMemo(() => {
    if (highestBidAmount != null) {
      return Math.max(1, Math.ceil(highestBidAmount * 1.1));
    }
    return Math.max(1, Math.ceil(referenceBid));
  }, [highestBidAmount, referenceBid]);

  const maximumBid = useMemo(() => {
    return Math.max(minimumBid, Math.floor(referenceBid * 10));
  }, [minimumBid, referenceBid]);

  useEffect(() => {
    setBidAmount(minimumBid);
  }, [minimumBid]);

  /**
   * Clamps and updates the current bid input amount based on the calculated 
   * minimum and maximum bounds for the listing.
   * 
   * * @param {number} nextValue - the intended bid amount from the input
   */
  function updateBidAmount(nextValue: number) {
    if (Number.isNaN(nextValue)) {
      return;
    }
    const clamped = Math.min(maximumBid, Math.max(minimumBid, Math.round(nextValue)));
    setBidAmount(clamped);
  }

  /**
   * Submits the current bid amount to the backend API.
   * * Validates the user's role, handles the loading state, and provides 
   * visual feedback via toasts and status banners on success or failure.
   */
  async function placeBid() {
    if (!accessToken || !isBidder) {
      setStatusTone("error");
      setStatusMessage("Only signed-in bidder accounts can place bids.");
      toast.error("Only bidder accounts can place bids.");
      return;
    }
    const token = accessToken;
    const user = currentUser;

    setLoadingLabel("Placing bid");
    try {
      const response = await api.placeBid(token, itemId, { amount: bidAmount });
      if (response.ok) {
        setStatusTone("success");
        setStatusMessage(`Bid at $${bidAmount} successful!`);
        setHighestBidAmount(bidAmount);
        setHighestBidderId(user?.profileId ?? user?.username ?? null);
        setItem((current) => current == null
          ? current
          : {
              ...current,
              bidCount: (current.bidCount ?? 0) + 1,
              highestBidAmount: bidAmount,
              highestBidderId: user?.profileId ?? user?.username ?? null
            });
        toast.success(`Bid at $${bidAmount} successful!`);
      } else {
        setStatusTone("error");
        setStatusMessage(response.raw || "We could not place your bid.");
        toast.error(response.raw || "We could not place your bid.");
      }
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(error instanceof Error ? error.message : "Unknown network error.");
      toast.error(error instanceof Error ? error.message : "Unknown network error.");
    } finally {
      setLoadingLabel(null);
    }
  }

  if (!ready) {
    return (
      <main className="px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-5xl">
          <StatusBanner title="Loading listing" body="Pulling up the latest listing details." tone="neutral" />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {!currentUser || !accessToken ? (
          <SectionCard title="Listing Details" subtitle="Sign In Required">
            <p className="text-sm leading-7 text-slate">
              Sign in from the marketplace to view listing details and place a bid.
            </p>
            <Link href="/" className="primary-button button-ink mt-5 inline-flex w-fit">
              Go to marketplace
            </Link>
          </SectionCard>
        ) : !item ? (
          <SectionCard title="Listing Unavailable" subtitle="Not Found">
            <p className="text-sm leading-7 text-slate">
              We could not find that listing right now. It may have been removed or expired.
            </p>
            <button type="button" className="primary-button button-ink mt-5 w-fit" onClick={() => router.back()}>
              Go back
            </button>
          </SectionCard>
        ) : (
          <>
            <StatusBanner title="Listing Update" body={statusMessage} tone={statusTone} />

            <SectionCard title={item.itemName || "Listing"} subtitle="Live Bidding">
              <div className="flex flex-wrap gap-3">
                <button type="button" className="primary-button button-ink w-fit" onClick={() => router.back()}>
                  Back to marketplace
                </button>
                {loadingLabel ? (
                  <span className="rounded-full bg-white/75 px-4 py-2 text-sm font-medium text-slate">
                    {loadingLabel}
                  </span>
                ) : null}
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="glass-tile px-6 py-6">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-slate">
                      Start ${item.startingPrice ?? "N/A"}
                    </span>
                    <span className="rounded-full bg-tide/10 px-3 py-1 text-xs font-medium text-tide">
                      {conditionLabel(item.condition)}
                    </span>
                    <span className="rounded-full bg-ember/10 px-3 py-1 text-xs font-medium text-ember">
                      {item.auctioneer?.name ?? item.auctioneer?.auctioneerId ?? "Unknown seller"}
                    </span>
                  </div>

                  <div className="mt-5 space-y-3 text-sm leading-7 text-slate">
                    <p>{item.description || "No description added for this listing yet."}</p>
                    <p>
                      Current max bid:{" "}
                      <span className="font-semibold text-ink">
                        {highestBidAmount != null ? `$${highestBidAmount}` : "No bids yet"}
                      </span>
                    </p>
                    <p>
                      Current leader:{" "}
                      <span className="font-semibold text-ink">
                        {highestBidderId ?? "No bidder yet"}
                      </span>
                    </p>
                    <p>
                      Number of bids:{" "}
                      <span className="font-semibold text-ink">{item.bidCount ?? 0}</span>
                    </p>
                    <p>
                      Time remaining:{" "}
                      <span className="font-semibold text-tide">{formatTimeRemaining(item.expiresAt, now)}</span>
                    </p>
                  </div>
                </div>

                <div className="surface-panel p-6">
                  <p className="section-eyebrow">Place Your Bid</p>
                  <h2 className="mt-2 text-2xl text-ink">Bid Range</h2>
                  <p className="mt-3 text-sm leading-7 text-slate">
                    Your bid starts at 1.1x the current top bid and is capped at 10x the current reference price.
                  </p>

                  <div className="mt-5 grid gap-3">
                    <div className="glass-tile px-4 py-4 text-sm text-slate">
                      <p>Minimum allowed bid: ${minimumBid}</p>
                      <p>Maximum allowed bid: ${maximumBid}</p>
                    </div>

                    {isBidder ? (
                      <>
                        <label className="field-label">
                          Your bid
                          <input
                            className="field-input"
                            type="number"
                            min={minimumBid}
                            max={maximumBid}
                            step={1}
                            value={bidAmount}
                            onChange={(event) => updateBidAmount(Number(event.target.value))}
                          />
                        </label>
                        <button
                          type="button"
                          className="primary-button button-moss w-full"
                          onClick={placeBid}
                        >
                          Submit bid
                        </button>
                      </>
                    ) : (
                      <p className="rounded-[1.6rem] border border-dashed border-[color:var(--line-strong)] bg-white/55 p-5 text-sm leading-6 text-slate">
                        Only bidder accounts can place bids. Seller accounts can still view the live listing details.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </main>
  );
}
