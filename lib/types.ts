export type MerchType = "clothing" | "headwear" | "accessory";

export interface MerchItem {
  id: string;
  /** Canonical full name (used for export filename / aria-label). */
  name: string;
  /** Short label shown in the catalog grid. */
  shortName: string;
  type: MerchType;
  price: number;
  cloudinaryUrl: string;
  thumbnailUrl?: string;
}
