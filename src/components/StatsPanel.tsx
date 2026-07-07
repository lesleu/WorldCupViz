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
import { teamStatIconColorOverrides, pkScoredLegendIconColorOverrides } from "@/lib/statLegendColors";

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
  className?: string;
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

  if (showPenaltyShootout || stats.penaltyShootoutScored > 0) {
    rows.push({
      label: "PK Scored",
      value: stats.penaltyShootoutScored,
      icon: VISUAL_COMPONENT.Goal,
    });
  }

  return rows;
}

export function MatchTeamHeader({
  match,
  matchStatus,
  homeAccent,
  awayAccent,
}: {
  match: MatchData;
  matchStatus?: MatchStatus;
  homeAccent: string;
  awayAccent: string;
}) {
  return (
    <div className="mt-4 space-y-2 text-center">
      <div className="flex items-center justify-center gap-3">
        <span
          className={`min-w-0 flex-1 text-right text-sm leading-tight ${interExtra}`}
          style={{ color: homeAccent }}
        >
          {match.homeTeam}
        </span>
        <div className="shrink-0 px-1">
          <p
            className={`font-mono text-lg tabular-nums ${interExtra}`}
            style={{ color: panelText }}
          >
            {match.home.goals}–{match.away.goals}
          </p>
          <p
            className={`text-[9px] uppercase tracking-[0.2em] ${interSemi}`}
            style={{ color: panelMuted }}
          >
            vs
          </p>
        </div>
        <span
          className={`min-w-0 flex-1 text-left text-sm leading-tight ${interExtra}`}
          style={{ color: awayAccent }}
        >
          {match.awayTeam}
        </span>
      </div>
      <p
        className={`text-[10px] uppercase tracking-[0.2em] ${interSemi}`}
        style={{ color: panelMuted }}
      >
        {match.stage}
        {match.date ? ` · ${match.date}` : ""}
      </p>
      {matchStatus === "live" && (
        <div className="flex justify-center pt-1">
          <LiveBadge />
        </div>
      )}
    </div>
  );
}

export function TeamStatsBlock({
  teamName,
  stats,
  accent,
  teamPalette,
  showPenaltyShootout = false,
  className = "",
}: {
  teamName: string;
  stats: TeamStats;
  accent: string;
  teamPalette: TeamPalette;
  showPenaltyShootout?: boolean;
  className?: string;
}) {
  const rows = buildStatRows(stats, showPenaltyShootout);
  const coreRows = rows.slice(0, 10);
  const extraRows = rows.slice(10);

  const renderStatCell = ({ label, value, icon }: StatRow) => (
    <div
      key={label}
      className="flex min-w-0 flex-col items-center gap-1 rounded-sm border px-2 py-2.5 min-[615px]:grid min-[615px]:grid-cols-[20px_minmax(0,1fr)_auto] min-[615px]:items-center min-[615px]:gap-x-2 min-[615px]:rounded-none min-[615px]:border-0 min-[615px]:border-b min-[615px]:px-0 min-[615px]:py-0 min-[615px]:pb-2"
      style={{ borderColor: panelBorder }}
    >
      <StatRowIcon
        component={icon}
        teamPalette={label === "PK Scored" ? undefined : teamPalette}
        colorOverrides={
          label === "PK Scored"
            ? pkScoredLegendIconColorOverrides()
            : teamStatIconColorOverrides(icon, teamPalette)
        }
      />
      <dt
        className={`text-center text-[10px] uppercase leading-tight tracking-wide min-[615px]:text-[11px] min-[615px]:tracking-wider ${interSemi}`}
        style={{ color: panelMuted }}
      >
        {label}
      </dt>
      <dd
        className={`text-sm tabular-nums min-[615px]:text-right ${interSemi}`}
        style={{ color: panelText }}
      >
        {value}
      </dd>
    </div>
  );

  return (
    <section className={`space-y-3 ${className}`}>
      <h2
        className={`text-center text-xs uppercase tracking-[0.25em] ${interExtra}`}
        style={{ color: accent }}
      >
        {teamName}
      </h2>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 min-[615px]:grid-cols-1 min-[615px]:gap-y-0 min-[615px]:space-y-2">
        {coreRows.map(renderStatCell)}
        {extraRows.map(renderStatCell)}
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

export function MatchModeControls({
  match,
  mode,
  matchStatus,
  hasReplayFeed = false,
  replayUi,
  replayActions,
  onModeChange,
  className = "",
}: {
  match: MatchData | null;
  mode: AppMode;
  matchStatus?: MatchStatus;
  hasReplayFeed?: boolean;
  replayUi: ReplayUiState;
  replayActions: RefObject<ReplayActions>;
  onModeChange: (mode: AppMode) => void;
  className?: string;
}) {
  const actions = () => replayActions.current;

  return (
    <div
      className={`border-b p-4 min-[615px]:p-5 ${className}`}
      style={{ borderColor: panelBorder, backgroundColor: panelBg }}
    >
      <p
        className={`text-[10px] uppercase tracking-[0.35em] ${interSemi}`}
        style={{ color: panelMuted }}
      >
        Match Data
      </p>
      <h1
        className={`mt-2 hidden text-lg min-[615px]:block ${interExtra}`}
        style={{ color: panelText }}
      >
        World Cup Vizi
      </h1>

      {matchStatus === "live" && (
        <div className="mt-3 hidden min-[615px]:block">
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

      {mode === "replay" && match && (
        <div className="mt-4 space-y-3">
          <p
            className={`hidden text-[10px] uppercase tracking-wider min-[615px]:block ${interSemi}`}
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
                        color: replayUi.speed === speed ? panelBg : panelText,
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
  className = "",
}: StatsPanelProps) {
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
      className={`flex w-full shrink-0 flex-col overflow-visible border-t min-[615px]:h-full min-[615px]:w-72 min-[615px]:overflow-hidden min-[615px]:border-l min-[615px]:border-t-0 ${className}`}
      style={{ backgroundColor: panelBg, borderColor: panelBorder }}
    >
      <MatchModeControls
        match={match}
        mode={mode}
        matchStatus={matchStatus}
        hasReplayFeed={hasReplayFeed}
        replayUi={replayUi}
        replayActions={replayActions}
        onModeChange={onModeChange}
        className="border-b"
      />

      <div className="p-4 min-[615px]:flex-1 min-[615px]:overflow-y-auto min-[615px]:p-5">
        {mode === "live" ? (
          <>
            <div className="hidden min-[615px]:block">
              <LiveModePanel match={match} matchStatus={matchStatus} />
            </div>
            {match && (
              <div className="space-y-8 min-[615px]:mt-8">
                <TeamStatsBlock
                  teamName={match.homeTeam}
                  stats={match.home}
                  accent={homeAccent}
                  teamPalette={homePalette}
                  showPenaltyShootout={showPenaltyShootout}
                />
                <TeamStatsBlock
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
            <TeamStatsBlock
              teamName={match.homeTeam}
              stats={match.home}
              accent={homeAccent}
              teamPalette={homePalette}
              showPenaltyShootout={showPenaltyShootout}
            />
            <TeamStatsBlock
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
