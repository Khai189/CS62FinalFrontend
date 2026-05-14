"use client";

import { useEffect, useState } from "react";
import type { BidItem } from "@/lib/types";

/**
 * Formats a bid item's condition string for display within the grid.
 * 
 * * @param {BidItem["condition"]} condition - the raw condition string from the bid item
 * @returns {string} the formatted condition string with spaces, or a fallback if unavailable
 */
function conditionLabel(condition: BidItem["condition"]) {
  return condition ? condition.replaceAll("_", " ") : "Condition unavailable";
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

type ItemGridProps = {
  title: string;
  subtitle: string;
  items: BidItem[];
  emptyMessage: string;
  selectedItemId?: string;
  showBidStats?: boolean;
  onSelect?: (item: BidItem) => void;
};

/**
 * Renders a responsive grid of marketplace items.
 * 
 * * @param {ItemGridProps} props - the component props
 * @param {string} props.title - the main heading for the grid section
 * @param {string} props.subtitle - the secondary eyebrow text displayed above the title
 * @param {BidItem[]} props.items - the list of bid items to display in the grid
 * @param {string} props.emptyMessage - the message to show when the items array is empty
 * @param {string} [props.selectedItemId] - the ID of the currently selected item to highlight it visually
 * @param {boolean} [props.showBidStats=false] - whether to display additional bidding metadata (highest bid, bidder ID, bid count)
 * @param {(item: BidItem) => void} [props.onSelect] - optional callback triggered when an item card is clicked
 * @returns {JSX.Element} the rendered ItemGrid component
 */
export function ItemGrid({
  title,
  subtitle,
  items,
  emptyMessage,
  selectedItemId,
  showBidStats = false,
  onSelect
}: ItemGridProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="surface-panel p-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="section-eyebrow">{subtitle}</p>
          <h2 className="mt-2 text-2xl text-ink">{title}</h2>
        </div>
        <p className="hero-chip">{items.length} item{items.length === 1 ? "" : "s"}</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-[1.6rem] border border-dashed border-[color:var(--line-strong)] bg-white/55 p-5 text-sm leading-6 text-slate">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const isSelected = item.itemId === selectedItemId;

            return (
              <button
                key={item.itemId}
                type="button"
                onClick={() => onSelect?.(item)}
                className={`rounded-[1.6rem] border p-5 text-left transition duration-200 ${
                  isSelected
                    ? "border-tide bg-gradient-to-br from-tide/10 to-white shadow-[0_18px_30px_rgba(47,111,115,0.14)]"
                    : "border-[color:var(--line)] bg-white/72 hover:-translate-y-1 hover:border-tide/25"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl text-ink">{item.itemName || "Untitled listing"}</h3>
                  </div>
                  {isSelected ? (
                    <span className="rounded-full bg-tide px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white">
                      Selected
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
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
                <div className="mt-4 text-sm leading-6 text-slate">
                  {item.description ? <p>{item.description}</p> : <p>No description available yet.</p>}
                </div>
                <p className="mt-4 text-sm font-medium text-tide">
                  {formatTimeRemaining(item.expiresAt, now)}
                </p>
                {showBidStats ? (
                  <div className="mt-4 grid gap-2 text-sm leading-6 text-slate">
                    <p>
                      Current highest bid:{" "}
                      <span className="font-semibold text-ink">
                        {item.highestBidAmount != null ? `$${item.highestBidAmount}` : "No bids yet"}
                      </span>
                    </p>
                    <p>
                      Current highest bidder:{" "}
                      <span className="font-semibold text-ink">
                        {item.highestBidderId ?? "No bidder yet"}
                      </span>
                    </p>
                    <p>
                      Number of bids:{" "}
                      <span className="font-semibold text-ink">{item.bidCount ?? 0}</span>
                    </p>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
