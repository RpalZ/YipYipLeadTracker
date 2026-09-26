"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SideDrawer } from "@/components/side-drawer";
import { useInterfacePreferences } from "@/components/interface-preferences";
import { useReviewBasket } from "@/components/use-review-basket";
import type { DashboardData, OpportunityView } from "@/lib/domain";

function BasketIcon({ name }: { name: "basket" | "arrow" | "close" }) {
  const paths = {
    basket: <><path d="m5 9 2 11h10l2-11H5Z" /><path d="m9 9 3-5 3 5" /></>,
    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function leadHref(opportunityId: string, demoMode?: DashboardData["demoMode"]) {
  const params = new URLSearchParams({ lead: opportunityId });
  if (demoMode) params.set("demo", demoMode);
  return `/?${params.toString()}`;
}

export function ReviewBasketControl({
  opportunities,
  scope,
  demoMode,
  onBeforeOpen,
  onOpenChange,
  onSelect,
  managePageLock = true,
}: {
  opportunities: OpportunityView[];
  scope: string;
  demoMode?: DashboardData["demoMode"];
  onBeforeOpen?: (trigger: HTMLButtonElement) => void;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (id: string, trigger: HTMLButtonElement) => void;
  managePageLock?: boolean;
}) {
  const { copy } = useInterfacePreferences();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const availableIds = opportunities.map((opportunity) => opportunity.id);
  const basket = useReviewBasket(scope, availableIds);
  const items = basket.ids
    .map((id) => opportunities.find((opportunity) => opportunity.id === id))
    .filter((item): item is OpportunityView => Boolean(item));

  const setBasketOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open || !managePageLock) return;
    document.documentElement.classList.add("drawer-open");
    return () => document.documentElement.classList.remove("drawer-open");
  }, [managePageLock, open]);

  const close = () => {
    setBasketOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const select = (id: string, trigger: HTMLButtonElement) => {
    setBasketOpen(false);
    if (onSelect) onSelect(id, trigger);
    else router.push(leadHref(id, demoMode));
  };

  const reviewHref = demoMode ? `/reviewed?demo=${demoMode}` : "/reviewed";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="header-basket"
        aria-label={`${copy.basket.aria}, ${items.length} ${items.length === 1 ? copy.basket.savedLead : copy.basket.savedLeads}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (triggerRef.current) onBeforeOpen?.(triggerRef.current);
          setBasketOpen(true);
        }}
      >
        <BasketIcon name="basket" />
        <span className="header-basket-label">{copy.basket.label}</span>
        <span className="header-basket-count">{items.length}</span>
      </button>

      {open ? (
        <SideDrawer className="basket-drawer" labelledBy="basket-drawer-title" onRequestClose={close}>
          <header className="drawer-header basket-drawer-header">
            <div>
              <span className="section-label">{copy.basket.shortlist}</span>
              <h2 id="basket-drawer-title">{copy.basket.title}</h2>
              <p>{copy.basket.intro}</p>
            </div>
            <button type="button" className="drawer-close" onClick={close} aria-label={copy.basket.close}>
              <BasketIcon name="close" />
            </button>
          </header>

          <div className="basket-drawer-count"><strong>{items.length}</strong><span>{items.length === 1 ? copy.basket.savedLead : copy.basket.savedLeads}</span></div>

          <div className="basket-drawer-content">
            {items.length ? (
              <>
                <div className="basket-list">
                  {items.map((item) => (
                    <div className="basket-item" key={item.id}>
                      <button type="button" onClick={(event) => select(item.id, event.currentTarget)}>
                        <span>{item.organization}</span>
                        <strong>{item.title}</strong>
                        <small>{item.score === null ? copy.common.unassessed : `${item.score}/100 ${copy.card.fit}`} · {item.location}</small>
                      </button>
                      <button type="button" onClick={() => basket.remove(item.id)} aria-label={`${copy.basket.remove}: ${item.title}`}>×</button>
                    </div>
                  ))}
                </div>
                <button type="button" className="review-basket-button" onClick={() => router.push(reviewHref)}>
                  {copy.basket.workspace}
                  <BasketIcon name="arrow" />
                </button>
                <button type="button" className="clear-basket" onClick={basket.clear}>{copy.basket.clear}</button>
              </>
            ) : (
              <div className="basket-empty">
                <BasketIcon name="basket" />
                <strong>{copy.basket.empty}</strong>
                <span>{copy.basket.emptyText}</span>
              </div>
            )}
          </div>
        </SideDrawer>
      ) : null}
    </>
  );
}
