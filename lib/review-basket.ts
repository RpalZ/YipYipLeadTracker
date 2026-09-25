export const REVIEW_BASKET_STORAGE_PREFIX = "yipyip.review-basket.v1";

export function reviewBasketStorageKey(scope: string): string {
  return `${REVIEW_BASKET_STORAGE_PREFIX}:${scope.replace(/[^a-z0-9:_-]/gi, "-")}`;
}

export function parseReviewBasket(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
  } catch {
    return [];
  }
}

export function toggleReviewBasketItem(items: string[], id: string): string[] {
  return items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
}
