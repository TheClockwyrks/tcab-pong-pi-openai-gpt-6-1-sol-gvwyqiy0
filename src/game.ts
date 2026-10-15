import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { initialState } from "./world";
import { createDebug } from "./debug";
import { readMenus } from "./menus";
import { advanceMatch } from "./simulation";
import { render } from "./render";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";
export type Mode = "solo" | "versus";
export type Side = "left" | "right";
export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}
export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}
export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}
export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}
export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly theta: number;
}
export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";
  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;
  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;
  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly obstacleClock: number;
  readonly obstacleClockRunning: boolean;
  readonly simTime: number;
  readonly muted: boolean;
  /** Transient menu gesture bookkeeping; never part of the simulation. */
  readonly menuPress: Readonly<Record<number, number>>;
}
export type ReadState = DeepReadonly<CaromState>;
export interface MenuRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export type CaromSnapshot = Omit<CaromState, "ball" | "menuPress"> & {
  readonly version: number;
  readonly ball: (BallState & { readonly speed: number }) | null;
};
export interface CaromDebugApi {
  readonly version: number;
  clearWorld(s: ReadState): CaromState;
  spawnBall(s: ReadState): CaromState;
  spawnObstacle(s: ReadState, index: number): CaromState;
  reset(s: ReadState): CaromState;
  reconcile(s: ReadState): CaromState;
  setScreen(s: ReadState, screen: Screen): CaromState;
  setMode(s: ReadState, mode: Mode): CaromState;
  setMenuIndex(s: ReadState, index: number): CaromState;
  setTitleIndex(s: ReadState, index: number): CaromState;
  setResumeScreen(s: ReadState, screen: "countdown" | "playing"): CaromState;
  setScore(s: ReadState, p1: number, p2: number): CaromState;
  setWinner(s: ReadState, side: Side | null): CaromState;
  setReceiver(s: ReadState, side: Side): CaromState;
  setPaddleCy(s: ReadState, side: Side, cy: number): CaromState;
  setPaddleVy(s: ReadState, side: Side, vy: number): CaromState;
  setPaddleDriven(s: ReadState, side: Side, driven: boolean): CaromState;
  setBallPosition(s: ReadState, x: number, y: number): CaromState;
  setBallVelocity(s: ReadState, vx: number, vy: number): CaromState;
  setBallSpin(s: ReadState, spin: number): CaromState;
  setBallHeld(s: ReadState, held: boolean): CaromState;
  setBallHoldTimer(s: ReadState, seconds: number): CaromState;
  setBallServeSign(s: ReadState, sign: 1 | -1): CaromState;
  drawBallServeSign(s: ReadState): CaromState;
  setAiTracking(s: ReadState, enabled: boolean): CaromState;
  setAiMovement(s: ReadState, enabled: boolean): CaromState;
  setMuted(s: ReadState, muted: boolean): CaromState;
  setObstacleClock(s: ReadState, t: number): CaromState;
  setObstacleClockRunning(s: ReadState, running: boolean): CaromState;
  snapshot(s: ReadState): CaromSnapshot;
  menuItemRect(s: ReadState, index: number): MenuRect | null;
}

export const BACKGROUND = "#090f19";
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    api.audio.define(C.CUES.paddleHit, {
      wave: "triangle",
      freq: 620,
      freqTo: 260,
      durationMs: 75,
      gain: 0.2,
    });
    api.audio.define(C.CUES.wallBounce, {
      wave: "sine",
      freq: 300,
      freqTo: 180,
      durationMs: 55,
      gain: 0.16,
    });
    api.audio.define(C.CUES.obstacleBounce, {
      wave: "triangle",
      freq: 880,
      freqTo: 440,
      durationMs: 100,
      gain: 0.16,
    });
    api.audio.define(C.CUES.score, {
      wave: "sine",
      freq: 390,
      freqTo: 780,
      durationMs: 240,
      gain: 0.2,
    });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("score", (s) => `${s.score.p1} : ${s.score.p2}`);
    api.diagnostics.register("ball position", (s) =>
      s.ball ? `${s.ball.x.toFixed(1)}, ${s.ball.y.toFixed(1)}` : "none",
    );
    api.diagnostics.register("ball velocity", (s) =>
      s.ball ? `${s.ball.vx.toFixed(1)}, ${s.ball.vy.toFixed(1)}` : "none",
    );
    api.diagnostics.register("ball speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "none",
    );
    api.diagnostics.register("ball spin", (s) => s.ball?.spin ?? "none");
    for (const side of ["left", "right"] as const)
      api.diagnostics.register(
        `${side} cy / vy`,
        (s) =>
          `${s.paddles[side].cy.toFixed(1)} / ${s.paddles[side].vy.toFixed(1)}`,
      );
    return [initialState(false), createDebug()];
  },
  update(state, api, dt) {
    const edges = Object.fromEntries(
      C.ACTIONS.map((name) => [name, api.input.pressed(name)]),
    ) as Record<C.ActionName, boolean>;
    const muted = edges.mute ? !state.muted : state.muted;
    api.audio.setMuted(muted);
    let next = readMenus(
      { ...state, muted, simTime: state.simTime + dt },
      api.input,
      edges,
    );
    if (next.screen === "countdown" || next.screen === "playing") {
      const cues = new Set<C.CueName>();
      next = advanceMatch(next, api.input, dt, cues);
      for (const cue of cues) api.audio.play(cue);
    }
    return { ...next, muted: api.audio.muted() };
  },
  render,
};
