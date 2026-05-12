import type { BidItem } from "@/lib/types";

type ItemGridProps = {
  title: string;
  subtitle: string;
  items: BidItem[];
  emptyMessage: string;
  selectedItemId?: string;
  onSelect?: (item: BidItem) => void;
};

export function ItemGrid({
  title,
  subtitle,
  items,
  emptyMessage,
  selectedItemId,
  onSelect
}: ItemGridProps) {
  return (
    <div className="rounded-4xl border border-white/60 bg-[rgba(255,252,247,0.86)] p-6 shadow-card backdrop-blur">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate">{subtitle}</p>
          <h2 className="mt-2 text-2xl text-ink">{title}</h2>
        </div>
        <p className="text-sm text-slate">{items.length} item{items.length === 1 ? "" : "s"}</p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-[color:var(--line)] bg-white/50 p-5 text-sm text-slate">
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
                className={`rounded-3xl border p-5 text-left transition ${
                  isSelected
                    ? "border-tide bg-tide/10 shadow-sm"
                    : "border-[color:var(--line)] bg-white/70 hover:-translate-y-0.5"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg text-ink">{item.itemName || item.itemId}</h3>
                    <p className="mt-1 text-sm text-slate">{item.itemId}</p>
                  </div>
                  {isSelected ? (
                    <span className="rounded-full bg-tide px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                      Selected
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-1 text-sm text-slate">
                  <p>Starting price: {item.startingPrice ?? "N/A"}</p>
                  <p>Auctioneer: {item.auctioneer?.name ?? item.auctioneer?.auctioneerId ?? "Unknown"}</p>
                  {item.description ? <p>{item.description}</p> : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
