"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export function SideDrawer({
  className,
  labelledBy,
  onRequestClose,
  children,
}: {
  className: string;
  labelledBy: string;
  onRequestClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onRequestClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={`side-drawer ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onRequestClose();
        }
      }}
      onClick={handleBackdropClick}
    >
      <motion.div
        className="drawer-surface"
        initial={prefersReducedMotion ? false : { opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </dialog>
  );
}
