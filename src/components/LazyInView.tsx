"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface LazyInViewProps {
  children: ReactNode;
  /** Preload when within this margin of the viewport. */
  rootMargin?: string;
  className?: string;
}

/** Mount children only when near the viewport — keeps off-screen cards cheap. */
export default function LazyInView({
  children,
  rootMargin = "240px 0px",
  className,
}: LazyInViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin }
    );

    observer.observe(host);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  return (
    <div ref={hostRef} className={className}>
      {visible ? children : <div className="aspect-video w-full bg-[#1A1A1A]" aria-hidden />}
    </div>
  );
}
