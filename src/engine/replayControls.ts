import type { ReplaySpeed } from "@/engine/replayEngine";

/** UI snapshot — safe to store in React state. */
export interface ReplayUiState {
  isPlaying: boolean;
  minute: number;
  speed: ReplaySpeed;
  ready: boolean;
}

/** Imperative actions — always read from ref, never from React state. */
export interface ReplayActions {
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: ReplaySpeed) => void;
}

export type ReplayControlBundle = ReplayUiState & ReplayActions;

export const EMPTY_REPLAY_UI: ReplayUiState = {
  isPlaying: false,
  minute: 0,
  speed: 1,
  ready: false,
};

export const NOOP_REPLAY_ACTIONS: ReplayActions = {
  play: () => {},
  pause: () => {},
  reset: () => {},
  setSpeed: () => {},
};
