"use client";

import { Shirt, Check } from "lucide-react";
import { MERCH_CATALOG, MERCH_TYPE_LABEL } from "@/lib/merchData";
import type { MerchItem } from "@/lib/types";

interface MerchCatalogProps {
  onSelect: (item: MerchItem) => void;
  /** IDs currently on the canvas — shown with a check badge. */
  activeIds?: ReadonlySet<string>;
  disabled?: boolean;
}

export function MerchCatalog({ onSelect, activeIds, disabled }: MerchCatalogProps) {
  const grouped = MERCH_CATALOG.reduce<Record<string, MerchItem[]>>(
    (acc, item) => {
      (acc[item.type] ||= []).push(item);
      return acc;
    },
    {},
  );

  return (
    <aside className="flex h-full flex-col gap-4">
      <div>
        <h2 className="text-base font-bold text-brand-ink">Pick your merch</h2>
        <p className="mt-0.5 text-xs text-brand-smoke">
          {disabled
            ? "Upload a photo first"
            : "Tap an item to try it on. Tap again to swap."}
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {Object.entries(grouped).map(([type, items]) => (
          <section key={type}>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-smoke">
              {MERCH_TYPE_LABEL[type as MerchItem["type"]]}
            </h3>
            <ul className="grid grid-cols-2 gap-3">
              {items.map((item) => {
                const isActive = activeIds?.has(item.id) ?? false;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={item.name}
                      onClick={() => onSelect(item)}
                      className={[
                        "group relative flex w-full flex-col gap-2 rounded-2xl border bg-white p-2.5 text-left shadow-card transition",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        isActive
                          ? "border-brand-red ring-2 ring-brand-red/30"
                          : "border-brand-line hover:border-brand-red/60 hover:shadow-cardHover",
                      ].join(" ")}
                    >
                      {isActive && (
                        <span className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-brand-red text-white shadow-glow">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                      <div className="aspect-square w-full overflow-hidden rounded-xl bg-brand-cream">
                        <MerchThumb item={item} />
                      </div>
                      <div className="px-0.5 pb-0.5">
                        <p className="text-sm font-semibold text-brand-ink">
                          {item.shortName}
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-brand-red">
                          ${item.price}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}

function MerchThumb({ item }: { item: MerchItem }) {
  const url = item.thumbnailUrl ?? item.cloudinaryUrl;
  const isPlaceholder = url.includes("REPLACE_ME") || url.includes("/placeholder/");

  if (isPlaceholder) {
    return (
      <div className="grid h-full w-full place-items-center text-brand-smoke/60">
        <Shirt className="h-8 w-8" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={item.name}
      className="h-full w-full object-contain p-2 transition group-hover:scale-105"
      loading="lazy"
    />
  );
}
