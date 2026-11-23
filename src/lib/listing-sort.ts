export type ListingDisplaySort = "newest" | "price-asc" | "price-desc";

type SortableListing = {
  isVip: boolean;
  vipAssignedAt?: Date | string | null;
  createdAt: Date | string;
  price: number;
};

function timestamp(value: Date | string | null | undefined) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string") return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function compareListings(left: SortableListing, right: SortableListing, sort: ListingDisplaySort = "newest") {
  if (left.isVip !== right.isVip) return Number(right.isVip) - Number(left.isVip);

  const createdAtOrder = timestamp(right.createdAt) - timestamp(left.createdAt);
  if (left.isVip) {
    return timestamp(right.vipAssignedAt) - timestamp(left.vipAssignedAt) || createdAtOrder;
  }
  if (sort === "price-asc") return left.price - right.price || createdAtOrder;
  if (sort === "price-desc") return right.price - left.price || createdAtOrder;
  return createdAtOrder;
}
