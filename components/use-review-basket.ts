"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import {
  parseReviewBasket,
  reconcileReviewBasket,
  reviewBasketStorageKey,
  toggleReviewBasketItem,
} from "@/lib/review-basket";

const EVENT_NAME = "yipyip-review-basket";

export function useReviewBasket(scope: string, availableIds?: readonly string[]) {
  const key = useMemo(() => reviewBasketStorageKey(scope), [scope]);
  const availableIdSignature = availableIds?.join("\u0000") ?? null;
  const availableIdSet = useMemo(
    () => availableIdSignature === null ? null : availableIdSignature.split("\u0000").filter(Boolean),
    [availableIdSignature],
  );
  const subscribe = useCallback((onStoreChange: () => void) => {
    const handleChange = () => onStoreChange();
    window.addEventListener("storage", handleChange);
    window.addEventListener(EVENT_NAME, handleChange);
    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener(EVENT_NAME, handleChange);
    };
  }, []);
  const serialized = useSyncExternalStore(
    subscribe,
    () => window.sessionStorage.getItem(key) ?? "[]",
    () => "[]",
  );
  const storedIds = useMemo(() => parseReviewBasket(serialized), [serialized]);
  const ids = useMemo(
    () => availableIdSet === null ? storedIds : reconcileReviewBasket(storedIds, availableIdSet),
    [availableIdSet, storedIds],
  );

  const write = useCallback((next: string[]) => {
    window.sessionStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT_NAME));
  }, [key]);

  useEffect(() => {
    if (availableIdSet === null || ids.length === storedIds.length) return;
    // Basket IDs can outlive an Opportunity after a demo reset, quarantine,
    // or workspace/data change. Persist the reconciled list so the shared
    // badge and drawer cannot disagree about how many usable items exist.
    write(ids);
  }, [availableIdSet, ids, storedIds.length, write]);

  return {
    ids,
    toggle: useCallback((id: string) => write(toggleReviewBasketItem(parseReviewBasket(window.sessionStorage.getItem(key)), id)), [key, write]),
    remove: useCallback((id: string) => write(parseReviewBasket(window.sessionStorage.getItem(key)).filter((item) => item !== id)), [key, write]),
    clear: useCallback(() => write([]), [write]),
  };
}
