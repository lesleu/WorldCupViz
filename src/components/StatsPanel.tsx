"use client";

import type { RefObject } from "react";
import type { MatchData, TeamStats } from "@/data/mockMatch";
import type { MatchStatus } from "@/data/matchCatalog";
import type { AppMode } from "@/components/MatchVisualizer";
import type { ReplayActions, ReplayUiState } from "@/engine/replayControls";
import { VISUALIZER_CONFIG } from "@/config";
import { cfg } from "@/config";
import type { TeamPalette } from "@/data/teamPalettes.generated";
import { VISUAL_COMPONENT, type VisualComponent } from "@/design-system/mapping/visualMappings";
import { getTeamPalette } from "@/data/mockMatch";
import LiveBadge from "@/components/LiveBadge";
import StatRowIcon from "@/components/StatRowIcon";

const panelBg = VISUALIZER_CONFIG.colors.background;
const panelText = VISUALIZER_CONFIG.colors.text;
const panelMuted = VISUALIZER_CONFIG.colors.textMuted;
const panelBorder = "rgba(234, 234, 234, 0.15)";
const interSemi =
  "font-[family-name:var(--font-inter-semibold)] font-semibold";
const interExtra =
  "font-[family-name:var(--font-inter-extrabold)] font-extrabold";

interface StatRow {
  label: string;
  value: string | number;
  icon: VisualComponent | null;
}

interface StatsPanelProps {
  match: MatchData | null;
  mode: AppMode;
  matchStatus?: MatchStatus;
  hasReplayFeed?: boolean;
  replayUi: ReplayUiState;
  replayActions: RefObject<ReplayActions>;
  onModeChange: (mode: AppMode) => void;
}

function buildStatRows(
  stats: TeamStats,
  showPenaltyShootout: boolean
): StatRow[] {
  const rows: StatRow[] = [
    { label: "Possession", value: `${stats.possession}%`, icon: VISUAL_COMPONENT.PossessionGrid },
    { label: "Pass Accuracy", value: `${stats.passAccuracy}%`, icon: VISUAL_COMPONENT.PassAccuracy },
    { label: "Shots", value: stats.shots, icon: VISUAL_COMPONENT.Shot },
    { label: "Shots on Target", value: stats.shotsOnTarget, icon: VISUAL_COMPONENT.ShotOnTarget },
    { label: "Goals", value: stats.goals, icon: VISUAL_COMPONENT.Goal },
    { label: "Corners", value: stats.corners ?? 0, icon: VISUAL_COMPONENT.Corner },
    { label: "Offsides", value: stats.offsides ?? 0, icon: VISUAL_COMPONENT.Offside },
    { label: "Fouls", value: stats.fouls, icon: VISUAL_COMPONENT.Foul },
    { label: "Yellow Cards", value: stats.yellowCards, icon: VISUAL_COMPONENT.YellowCard },
    { label: "Red Cards", value: stats.redCards, icon: VISUAL_COMPONENT.RedCard },
  ];

  if (
    showPenaltyShootout ||
    stats.penaltyShootoutScored > 0 ||
    stats.penaltyShootoutMissed > 0
  ) {
    rows.push(
      { label: "PK Scored", value: stats.penaltyShootoutScored, icon: VISUAL_COMPONENT.Goal },
      { label: "PK Missed", value: stats.penaltyShootoutMissed, icon: VISUAL_COMPONENT.Shot }
    );
  }

  return rows;
}

function TeamBlock({
  teamName,
  stats,
  accent,
  teamPalette,
  showPenaltyShootout = false,
}: {
  teamName: string;
  stats: TeamStats;
  accent: string;
  teamPalette: TeamPalette;
  showPenaltyShootout?: boolean;
}) {
  const rows = buildStatRows(stats, showPenaltyShootout);

  return (
    <section className="space-y-3">
      <h2
        className={`text-center text-xs uppercase tracking-[0.25em] ${interExtra}`}
        style={{ color: accent }}
      >
        {teamName}
      </h2>
      <dl className="space-y-2">
        {rows.map(({ label, value, icon }) => (
          <div
            key={label}
            className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-2 border-b pb-2"
            style={{ borderColor: panelBorder }}
          >
            <StatRowIcon
              component={icon}
              colorOverrides={
                icon === VISUAL_COMPONENT.Corner
                  ? { c5: teamPalette.c5 }
                  : undefined
              }
            />
            <dt
              className={`text-center text-[11px] uppercase tracking-wider ${interSemi}`}
              style={{ color: panelMuted }}
            >
              {label}
            </dt>
            <dd
              className={`text-sm tabular-nums ${interSemi}`}
              style={{ color: panelText }}
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
        backgroundColor: active ? panelText : "transparent",
        color: active ? panelBg : panelText,
        borderColor: active ? panelText : panelBorder,
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
          className={`text-xs uppercase tracking-[0.25em] ${interExtra}`}
          style={{ color: panelText }}
        >
          Live Match Mode
        </p>
        <p
          className={`mt-2 text-xs leading-relaxed ${interSemi}`}
          style={{ color: panelMuted }}
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
          className={`text-[10px] uppercase tracking-wider ${interSemi}`}
          style={{ color: panelMuted }}
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

  const homePalette = match ? getTeamPalette(match.homeTeamCode) : getTeamPalette("MEX");
  const awayPalette = match ? getTeamPalette(match.awayTeamCode) : getTeamPalette("KOR");
  const homeAccent = homePalette.c1;
  const awayAccent = awayPalette.c1;

  return (
    <aside
      className="flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden border-l"
      style={{ backgroundColor: panelBg, borderColor: panelBorder }}
    >
      <div className="border-b p-5" style={{ borderColor: panelBorder }}>
        <p
          className={`text-[10px] uppercase tracking-[0.35em] ${interSemi}`}
          style={{ color: panelMuted }}
        >
          Match Data
        </p>
        <h1
          className={`mt-2 text-lg ${interExtra}`}
          style={{ color: panelText }}
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
                  className={`text-[10px] uppercase tracking-wider ${interSemi}`}
                  style={{ color: panelMuted }}
                >
                  {match.homeTeam} vs {match.awayTeam}
                </p>

                {!hasReplayFeed && (
                  <p
                    className={`text-[10px] uppercase tracking-wider ${interSemi}`}
                    style={{ color: panelMuted }}
                  >
                    Replay coming soon
                  </p>
                )}

                {!replayUi.ready && (
                  <p
                    className={`text-[10px] uppercase tracking-wider ${interSemi}`}
                    style={{ color: panelMuted }}
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
                        className="flex-1 border px-2 py-2 font-mono text-[10px] uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          backgroundColor: "transparent",
                          color: panelText,
                          borderColor: panelBorder,
                        }}
                      >
                        {replayUi.isPlaying ? "Pause" : "Play"}
                      </button>
                      <button
                        type="button"
                        disabled={!replayUi.ready}
                        onClick={() => actions().reset()}
                        className="flex-1 border px-2 py-2 font-mono text-[10px] uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          backgroundColor: "transparent",
                          color: panelText,
                          borderColor: panelBorder,
                        }}
                      >
                        Reset
                      </button>
                    </div>

                    <div>
                      <p
                        className="mb-2 font-mono text-[10px] uppercase tracking-wider"
                        style={{ color: panelMuted }}
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
                            className="flex-1 border px-1 py-1.5 font-mono text-[10px] uppercase transition disabled:cursor-not-allowed disabled:opacity-40"
                            style={{
                              backgroundColor:
                                replayUi.speed === speed ? panelText : "transparent",
                              color:
                                replayUi.speed === speed ? panelBg : panelText,
                              borderColor:
                                replayUi.speed === speed ? panelText : panelBorder,
                            }}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <p
                      className={`text-[10px] uppercase tracking-wider ${interSemi}`}
                      style={{ color: panelMuted }}
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
                  accent={homeAccent}
                  teamPalette={homePalette}
                  showPenaltyShootout={showPenaltyShootout}
                />
                <TeamBlock
                  teamName={match.awayTeam}
                  stats={match.away}
                  accent={awayAccent}
                  teamPalette={awayPalette}
                  showPenaltyShootout={showPenaltyShootout}
                />
              </div>
            )}
          </>
        ) : !match ? (
          <p
            className={`text-xs leading-relaxed ${interSemi}`}
            style={{ color: panelMuted }}
          >
            Demo match: Mexico vs South Korea.
          </p>
        ) : (
          <div className="space-y-8">
            <TeamBlock
              teamName={match.homeTeam}
              stats={match.home}
              accent={homeAccent}
              teamPalette={homePalette}
              showPenaltyShootout={showPenaltyShootout}
            />
            <TeamBlock
              teamName={match.awayTeam}
              stats={match.away}
              accent={awayAccent}
              teamPalette={awayPalette}
              showPenaltyShootout={showPenaltyShootout}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
