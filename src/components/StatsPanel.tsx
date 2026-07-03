"use client";

import type { RefObject } from "react";
import type { MatchData, TeamStats } from "@/data/mockMatch";
import type { MatchStatus } from "@/data/matchCatalog";
import type { AppMode } from "@/components/MatchVisualizer";
import type { ReplayActions, ReplayUiState } from "@/engine/replayControls";
import { cfg } from "@/config";
import { foundationsGenerated } from "@/config/foundations.generated";
import { getTeamPalette } from "@/data/mockMatch";
import LiveBadge from "@/components/LiveBadge";

const panelInk = foundationsGenerated.ink;
const panelPaper = foundationsGenerated.paper;

interface StatsPanelProps {
  match: MatchData | null;
  mode: AppMode;
  matchStatus?: MatchStatus;
  hasReplayFeed?: boolean;
  replayUi: ReplayUiState;
  replayActions: RefObject<ReplayActions>;
  onModeChange: (mode: AppMode) => void;
}

function TeamBlock({
  teamName,
  stats,
  accent,
  showPenaltyShootout = false,
}: {
  teamName: string;
  stats: TeamStats;
  accent: string;
  showPenaltyShootout?: boolean;
}) {
  const rows: { label: string; value: string | number }[] = [
    { label: "Possession", value: `${stats.possession}%` },
    { label: "Shots", value: stats.shots },
    { label: "Shots on Target", value: stats.shotsOnTarget },
    { label: "Pass Accuracy", value: `${stats.passAccuracy}%` },
    { label: "Fouls", value: stats.fouls },
    { label: "Yellow Cards", value: stats.yellowCards },
    { label: "Red Cards", value: stats.redCards },
    { label: "Goals", value: stats.goals },
  ];

  if (
    showPenaltyShootout ||
    stats.penaltyShootoutScored > 0 ||
    stats.penaltyShootoutMissed > 0
  ) {
    rows.push(
      { label: "PK Scored", value: stats.penaltyShootoutScored },
      { label: "PK Missed", value: stats.penaltyShootoutMissed }
    );
  }

  return (
    <section className="space-y-3">
      <h2
        className="font-mono text-xs uppercase tracking-[0.25em]"
        style={{ color: accent }}
      >
        {teamName}
      </h2>
      <dl className="space-y-2">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-baseline justify-between border-b border-black/10 pb-2"
          >
            <dt
              className="text-[11px] uppercase tracking-wider"
              style={{ color: panelInk.textMuted }}
            >
              {label}
            </dt>
            <dd
              className="font-mono text-sm"
              style={{ color: panelInk.text }}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatReplayMinute(minute: number, isPlaying: boolean): string {
  const floored = Math.floor(minute);
  const regulation = cfg.replay.regulationMinutes;
  const max = cfg.replay.maxMatchMinutes;
  const pkStart = cfg.replay.penaltyShootoutStartMinute;

  if (floored >= pkStart) {
    return `${floored}' (penalties)`;
  }

  if (floored >= max || (!isPlaying && floored >= regulation && minute >= regulation)) {
    if (floored > regulation) {
      return `${floored}' (full time — extra time)`;
    }
    return `${floored}' (full time)`;
  }
  if (floored > regulation) {
    return `${floored}' (extra time)`;
  }
  return `${floored}'`;
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 border px-2 py-2 font-mono text-[10px] uppercase tracking-widest transition"
      style={{
        backgroundColor: active
          ? panelInk.text
          : panelPaper.cream,
        color: active ? panelPaper.cream : panelInk.text,
        borderColor: active ? panelInk.text : "rgba(0,0,0,0.2)",
      }}
    >
      {label}
    </button>
  );
}

function LiveModePanel({
  match,
  matchStatus,
}: {
  match: MatchData | null;
  matchStatus?: MatchStatus;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p
          className="font-mono text-xs uppercase tracking-[0.25em]"
          style={{ color: panelInk.text }}
        >
          Live Match Mode
        </p>
        <p
          className="mt-2 font-mono text-xs leading-relaxed"
          style={{ color: panelInk.textMuted }}
        >
          {matchStatus === "live"
            ? "Polling API-Football every 20s for events and statistics."
            : matchStatus === "completed"
              ? "Full-time generative poster. Switch to Replay Match to watch the art build from kickoff."
              : "Switch to a live fixture or wait for kickoff. Stats refresh automatically when live."}
        </p>
      </div>

      {match && (
        <p
          className="font-mono text-[10px] uppercase tracking-wider"
          style={{ color: panelInk.textMuted }}
        >
          {match.homeTeam} vs {match.awayTeam}
        </p>
      )}
    </div>
  );
}

export default function StatsPanel({
  match,
  mode,
  matchStatus,
  hasReplayFeed = false,
  replayUi,
  replayActions,
  onModeChange,
}: StatsPanelProps) {
  const actions = () => replayActions.current;
  const showPenaltyShootout =
    Boolean(match) &&
    (match!.home.penaltyShootoutScored > 0 ||
      match!.home.penaltyShootoutMissed > 0 ||
      match!.away.penaltyShootoutScored > 0 ||
      match!.away.penaltyShootoutMissed > 0);

  return (
    <aside
      className="flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden border-l border-black/10"
      style={{ backgroundColor: panelPaper.cream }}
    >
      <div className="border-b border-black/10 p-5">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.35em]"
          style={{ color: panelInk.textMuted }}
        >
          Match Data
        </p>
        <h1
          className="mt-2 text-lg font-semibold"
          style={{ color: panelInk.text }}
        >
          World Cup Vizi
        </h1>

        {matchStatus === "live" && (
          <div className="mt-3">
            <LiveBadge />
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <ModeButton
            active={mode === "replay"}
            label="Replay Match"
            onClick={() => onModeChange("replay")}
          />
          <ModeButton
            active={mode === "live"}
            label="Live Match"
            onClick={() => onModeChange("live")}
          />
        </div>

        {mode === "replay" && (
          <>
            {match && (
              <div className="mt-4 space-y-3">
                <p
                  className="font-mono text-[10px] uppercase tracking-wider"
                  style={{ color: panelInk.textMuted }}
                >
                  {match.homeTeam} vs {match.awayTeam}
                </p>

                {!hasReplayFeed && (
                  <p
                    className="font-mono text-[10px] uppercase tracking-wider"
                    style={{ color: panelInk.textMuted }}
                  >
                    Replay coming soon
                  </p>
                )}

                {!replayUi.ready && (
                  <p
                    className="font-mono text-[10px] uppercase tracking-wider"
                    style={{ color: panelInk.textMuted }}
                  >
                    Starting visualizer…
                  </p>
                )}

                {hasReplayFeed && (
                  <>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!replayUi.ready}
                        onClick={() => {
                          if (replayUi.isPlaying) actions().pause();
                          else actions().play();
                        }}
                        className="flex-1 border border-black/20 px-2 py-2 font-mono text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          backgroundColor: panelPaper.cream,
                          color: panelInk.text,
                        }}
                      >
                        {replayUi.isPlaying ? "Pause" : "Play"}
                      </button>
                      <button
                        type="button"
                        disabled={!replayUi.ready}
                        onClick={() => actions().reset()}
                        className="flex-1 border border-black/20 px-2 py-2 font-mono text-[10px] uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          backgroundColor: panelPaper.cream,
                          color: panelInk.text,
                        }}
                      >
                        Reset
                      </button>
                    </div>

                    <div>
                      <p
                        className="mb-2 font-mono text-[10px] uppercase tracking-wider"
                        style={{ color: panelInk.textMuted }}
                      >
                        Speed
                      </p>
                      <div className="flex gap-1">
                        {cfg.replay.speedOptions.map((speed) => (
                          <button
                            key={speed}
                            type="button"
                            disabled={!replayUi.ready}
                            onClick={() => actions().setSpeed(speed)}
                            className="flex-1 border px-1 py-1.5 font-mono text-[10px] uppercase disabled:cursor-not-allowed disabled:opacity-40"
                            style={{
                              backgroundColor:
                                replayUi.speed === speed
                                  ? panelInk.text
                                  : panelPaper.cream,
                              color:
                                replayUi.speed === speed
                                  ? panelPaper.cream
                                  : panelInk.text,
                              borderColor:
                                replayUi.speed === speed
                                  ? panelInk.text
                                  : "rgba(0,0,0,0.2)",
                            }}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <p
                      className="font-mono text-[10px] uppercase tracking-wider"
                      style={{ color: panelInk.textMuted }}
                    >
                      Minute: {formatReplayMinute(replayUi.minute, replayUi.isPlaying)}
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {mode === "live" ? (
          <>
            <LiveModePanel match={match} matchStatus={matchStatus} />
            {match && (
              <div className="mt-8 space-y-8">
                <TeamBlock
                  teamName={match.homeTeam}
                  stats={match.home}
                  accent={getTeamPalette(match.homeTeamCode).c1}
                  showPenaltyShootout={showPenaltyShootout}
                />
                <TeamBlock
                  teamName={match.awayTeam}
                  stats={match.away}
                  accent={getTeamPalette(match.awayTeamCode).c1}
                  showPenaltyShootout={showPenaltyShootout}
                />
              </div>
            )}
          </>
        ) : !match ? (
          <p
            className="font-mono text-xs leading-relaxed"
            style={{ color: panelInk.textMuted }}
          >
            Demo match: Mexico vs South Korea.
          </p>
        ) : (
          <div className="space-y-8">
            <TeamBlock
              teamName={match.homeTeam}
              stats={match.home}
              accent={getTeamPalette(match.homeTeamCode).c1}
              showPenaltyShootout={showPenaltyShootout}
            />
            <TeamBlock
              teamName={match.awayTeam}
              stats={match.away}
              accent={getTeamPalette(match.awayTeamCode).c1}
              showPenaltyShootout={showPenaltyShootout}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
