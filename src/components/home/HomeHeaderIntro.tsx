"use client";

import { useState } from "react";
import { VISUALIZER_CONFIG } from "@/config";
import HomeHeaderModals, {
  type HomeHeaderModalKind,
} from "@/components/home/HomeHeaderModals";
import { HEADER_TRANSITION } from "@/lib/homeHeaderLayout";

interface HomeHeaderIntroProps {
  compact: boolean;
  width: number;
}

const INTRO_COPY_LEAD =
  "World Cup Visual transforms live football matches into generative works of art.";
const INTRO_COPY_SECOND =
  "Every visualization is created from real match data, turning statistics and moments into unique compositions that evolve throughout the game.";

const introButtonClass =
  "rounded-[12px] border p-[8px] font-[family-name:var(--font-inter-extrabold)] text-[12px] font-extrabold uppercase tracking-wide transition-opacity hover:opacity-80";

export default function HomeHeaderIntro({
  compact,
  width,
}: HomeHeaderIntroProps) {
  const [activeModal, setActiveModal] = useState<HomeHeaderModalKind>(null);

  return (
    <>
      <div
        className="w-full overflow-hidden px-3"
        style={{
          display: compact ? "none" : "block",
          paddingBottom: compact ? 0 : 24,
          paddingTop: compact ? 0 : 12,
        }}
        aria-hidden={compact}
      >
        <div
          className="mx-auto flex w-full flex-col items-center"
          style={{ maxWidth: width, width: "100%" }}
        >
          <p
            className="w-full text-center font-[family-name:var(--font-inter-semibold)] text-[14px] font-semibold leading-snug tracking-[-0.03em]"
            style={{ color: VISUALIZER_CONFIG.colors.text }}
          >
            {INTRO_COPY_LEAD}
            <br />
            {INTRO_COPY_SECOND}
          </p>
          <div className="mt-4 flex shrink-0 flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className={introButtonClass}
              style={{
                borderColor: "#ebebeb",
                color: VISUALIZER_CONFIG.colors.text,
                backgroundColor: "transparent",
              }}
              onClick={() => setActiveModal("how-it-works")}
            >
              How It Works
            </button>
            <button
              type="button"
              className={introButtonClass}
              style={{
                borderColor: "#ebebeb",
                color: VISUALIZER_CONFIG.colors.text,
                backgroundColor: "transparent",
              }}
              onClick={() => setActiveModal("data-legend")}
            >
              Data Legend
            </button>
          </div>
        </div>
      </div>

      <HomeHeaderModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
      />
    </>
  );
}
