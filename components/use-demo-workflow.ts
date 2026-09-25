"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import {
  DEMO_WORKFLOW_STORAGE_KEY,
  createInitialDemoWorkflowState,
  parseDemoWorkflowState,
  reduceDemoWorkflow,
  type DemoWorkflowAction,
} from "@/lib/demo-workflow";

export function useDemoWorkflow() {
  const initialSnapshot = useMemo(() => JSON.stringify(createInitialDemoWorkflowState()), []);

  const subscribe = useCallback((onStoreChange: () => void) => {
    const handleChange = () => onStoreChange();
    window.addEventListener("storage", handleChange);
    window.addEventListener("yipyip-demo-workflow", handleChange);
    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener("yipyip-demo-workflow", handleChange);
    };
  }, []);

  const serialized = useSyncExternalStore(
    subscribe,
    () => window.sessionStorage.getItem(DEMO_WORKFLOW_STORAGE_KEY) ?? initialSnapshot,
    () => initialSnapshot,
  );
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const state = useMemo(() => parseDemoWorkflowState(serialized), [serialized]);

  const dispatch = useCallback((action: DemoWorkflowAction) => {
    const current = parseDemoWorkflowState(window.sessionStorage.getItem(DEMO_WORKFLOW_STORAGE_KEY));
    const next = reduceDemoWorkflow(current, action);
    window.sessionStorage.setItem(DEMO_WORKFLOW_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("yipyip-demo-workflow"));
  }, []);

  return { state, hydrated, dispatch };
}
