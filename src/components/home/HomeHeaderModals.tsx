"use client";

import { useEffect, useRef, useState } from "react";
import { VISUALIZER_CONFIG } from "@/config";
import StatRowIcon from "@/components/StatRowIcon";
import HomeHeaderModal from "@/components/home/HomeHeaderModal";
import StretchedInterTitle from "@/components/home/StretchedInterTitle";
import { DATA_LEGEND_ITEMS } from "@/lib/dataLegendItems";

export type HomeHeaderModalKind = "how-it-works" | "data-legend" | null;

interface HomeHeaderModalsProps {
  activeModal: HomeHeaderModalKind;
  onClose: () => void;
}

function ModalHeading({ text }: { text: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 56 });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const updateSize = () => {
      const width = Math.max(box.clientWidth, 1);
      const height = Math.max(box.clientHeight, 1);
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="h-28 w-full max-w-[520px]">
      <StretchedInterTitle
        text={text}
        width={size.width}
        height={size.height}
        className="block h-full w-full"
      />
    </div>
  );
}

export default function HomeHeaderModals({
  activeModal,
  onClose,
}: HomeHeaderModalsProps) {
  return (
    <>
      <HomeHeaderModal
        open={activeModal === "how-it-works"}
        onClose={onClose}
      >
        <ModalHeading text="HOW IT WORKS" />
        <p
          className="mt-6 w-full max-w-[560px] text-center font-[family-name:var(--font-inter-semibold)] text-[14px] font-semibold leading-[1.2] tracking-[-0.02em]"
          style={{ color: VISUALIZER_CONFIG.colors.text }}
        >
          Watch a live match as the artwork evolves in real time, or replay
          completed matches to explore every moment again. Every visualization is
          generated from live match data, creating a unique composition for each
          game.
          <br />
          <br />
          Want to know how it really works? Say hello on{" "}
          <a
            href="https://www.instagram.com/solar____beam/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            instagram :)
          </a>
        </p>
      </HomeHeaderModal>

      <HomeHeaderModal open={activeModal === "data-legend"} onClose={onClose}>
        <ModalHeading text="DATA LEGEND" />
        <div className="mt-6 grid w-full max-w-[560px] grid-cols-2 gap-x-6 gap-y-5">
          {DATA_LEGEND_ITEMS.map(({ label, component }) => (
            <div key={label} className="flex items-center gap-3">
              <StatRowIcon component={component} size={32} />
              <span
                className="font-[family-name:var(--font-inter-semibold)] text-[14px] font-semibold leading-[1.2] tracking-[-0.02em]"
                style={{ color: VISUALIZER_CONFIG.colors.text }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </HomeHeaderModal>
    </>
  );
}
