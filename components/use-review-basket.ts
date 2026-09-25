"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { parseReviewBasket, reviewBasketStorageKey, toggleReviewBasketItem } from "@/lib/review-basket";

const EVENT_NAME = "yipyip-review-basket";

export function useReviewBasket(scope: string) {
  const key = useMemo(() => reviewBasketStorageKey(scope), [scope]);
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
  const ids = useMemo(() => parseReviewBasket(serialized), [serialized]);

  const write = useCallback((next: string[]) => {
    window.sessionStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT_NAME));
  }, [key]);

  return {
    ids,
    toggle: useCallback((id: string) => write(toggleReviewBasketItem(parseReviewBasket(window.sessionStorage.getItem(key)), id)), [key, write]),
    remove: useCallback((id: string) => write(parseReviewBasket(window.sessionStorage.getItem(key)).filter((item) => item !== id)), [key, write]),
    clear: useCallback(() => write([]), [write]),
  };
}
