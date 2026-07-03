"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { VISUALIZER_CONFIG } from "@/config";

const MODAL_ANIMATION_MS = 280;

interface HomeHeaderModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function HomeHeaderModal({
  open,
  onClose,
  children,
}: HomeHeaderModalProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), MODAL_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-12 sm:p-16"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 backdrop-blur-md transition-opacity ease-out"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.55)",
          opacity: visible ? 1 : 0,
          transitionDuration: `${MODAL_ANIMATION_MS}ms`,
        }}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex w-full max-w-[720px] flex-col items-center rounded-[12px] border p-10 transition-[opacity,transform] ease-out sm:p-12"
        style={{
          backgroundColor: VISUALIZER_CONFIG.colors.background,
          borderColor: "rgba(234, 234, 234, 0.35)",
          color: VISUALIZER_CONFIG.colors.text,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(10px) scale(0.98)",
          transitionDuration: `${MODAL_ANIMATION_MS}ms`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
        <button
          type="button"
          aria-label="Close"
          className="mt-8 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-opacity hover:opacity-80"
          style={{ borderColor: "rgba(234, 234, 234, 0.35)" }}
          onClick={onClose}
        >
          <span className="text-lg leading-none" aria-hidden>
            ×
          </span>
        </button>
      </div>
    </div>,
    document.body
  );
}
