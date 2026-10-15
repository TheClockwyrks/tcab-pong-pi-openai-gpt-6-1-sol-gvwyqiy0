import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import type { CaromDebugApi, CaromState, ReadState } from "./game";
import * as C from "./constants";

const engines: Engine<CaromState, CaromDebugApi>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
});
async function setup(step = 8) {
  const target = new EventTarget();
  const engine = createEngine({
    canvas: createCanvas(C.FIELD_W, C.FIELD_H) as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    background: BACKGROUND,
    layout: C.LAYOUT,
    game,
    clock: new ConstantClock(step),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  engines.push(engine);
  await engine.initialize();
  const d = engine.debug;
  const pose = (fn: (s: ReadState) => CaromState) => engine.apply(fn);
  function key(code: string, down = true) {
    target.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  }
  async function tap(code: string) {
    key(code);
    await engine.advance(1);
    key(code, false);
  }
  function pointer(
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) {
    target.dispatchEvent(
      Object.assign(new Event(`pointer${type}`), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: true,
        button: 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  }
  function flight(x = 600, y = 360, vx = 520, vy = 0) {
    pose((s) => d.clearWorld(s));
    pose((s) => d.spawnBall(s));
    pose((s) => d.setBallHeld(s, false));
    pose((s) => d.setScreen(s, "playing"));
    pose((s) => d.setBallPosition(s, x, y));
    pose((s) => d.setBallVelocity(s, vx, vy));
    pose((s) => d.setAiMovement(s, false));
  }
  return { engine, d, pose, key, tap, pointer, flight };
}

describe("engine integration and menus", () => {
  it("initializes complete state and pure diagnostics", async () => {
    const { engine, d } = await setup();
    const before = d.snapshot(engine.state);
    const openingBall = engine.state.ball;
    expect(before).toMatchObject({
      version: C.CAROM_DEBUG_VERSION,
      screen: "title",
      receiver: "left",
      ball: { held: true, speed: 0 },
      ai: { tracking: true, movement: true },
    });
    expect(before.obstacles).toHaveLength(2);
    expect(engine.diagnostics().length).toBeGreaterThanOrEqual(9);
    expect(d.snapshot(engine.state)).toEqual(before);
    await engine.advance(5);
    expect(engine.state.simTime).toBeCloseTo(0.04);
    expect(engine.state.ball).toEqual(openingBall);
    expect(engine.state.obstacleClock).toBe(0);
  });
  it("wraps menus, remembers selection, and prioritizes movement", async () => {
    const { engine, tap, key } = await setup();
    await tap("KeyW");
    expect(engine.state.menuIndex).toBe(2);
    key("KeyW");
    key("KeyS");
    key("Enter");
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(1);
    expect(engine.state.screen).toBe("title");
    key("KeyW", false);
    key("KeyS", false);
    key("Enter", false);
    await tap("Enter");
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.titleIndex).toBe(1);
    await tap("Escape");
    expect(engine.state.screen).toBe("paused");
    await tap("KeyW");
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
  });
  it("shows instructions and returns by confirm or back", async () => {
    const { engine, tap } = await setup();
    await tap("KeyW");
    await tap("Enter");
    expect(engine.state.screen).toBe("howto");
    await tap("Escape");
    expect(engine.state.menuIndex).toBe(2);
    await tap("Enter");
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
  });
  it("pauses once per Escape and resumes the held timer", async () => {
    const { engine, tap } = await setup();
    await tap("Enter");
    const timer = engine.state.ball?.holdTimer;
    await tap("Escape");
    await engine.advance(20);
    expect(engine.state.screen).toBe("paused");
    expect(engine.state.ball?.holdTimer).toBe(timer);
    await tap("Escape");
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.ball?.holdTimer).toBeLessThan(timer!);
  });
  it("restarts a paused match and resumes with P", async () => {
    const { engine, tap, pose, d } = await setup();
    await tap("Enter");
    await tap("KeyP");
    await tap("KeyP");
    expect(engine.state.screen).toBe("countdown");
    pose((s) => d.setScore(s, 5, 4));
    await tap("KeyP");
    await tap("KeyS");
    await tap("Enter");
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
  });
  it("requires matching pointer edges, including across frames", async () => {
    const { engine, d, pointer } = await setup();
    const a = d.menuItemRect(engine.state, 0)!,
      b = d.menuItemRect(engine.state, 1)!;
    pointer("down", a.x + 20, a.y + 20);
    await engine.advance(1);
    pointer("up", b.x + 20, b.y + 20);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
    pointer("down", b.x + 20, b.y + 20);
    await engine.advance(1);
    pointer("up", b.x + 20, b.y + 20);
    await engine.advance(1);
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.screen).toBe("countdown");
  });
  it("touch selects and confirms in one input frame", async () => {
    const { engine, d, pointer } = await setup();
    const r = d.menuItemRect(engine.state, 2)!;
    pointer("down", r.x + 50, r.y + 20, 3, "touch");
    pointer("up", r.x + 50, r.y + 20, 3, "touch");
    await engine.advance(1);
    expect(engine.state.screen).toBe("howto");
  });
  it("toggles mute on all screens and still announces cues", async () => {
    const { engine, tap, d, pose, flight } = await setup();
    await tap("KeyM");
    expect(engine.state.muted).toBe(true);
    flight(500, 12, 0, -520);
    const gains: number[] = [];
    engine.events.on("cue:played", (e) => gains.push(e.gain));
    await engine.advance(1);
    expect(gains).toEqual([0]);
    pose((s) => d.setMuted(s, false));
    await engine.advance(1);
    expect(engine.state.muted).toBe(false);
  });
});

describe("simulation", () => {
  it("serves with the posed sign, without advancing on the serve frame", async () => {
    const { engine, pose, d } = await setup(10);
    pose((s) => d.setScreen(s, "countdown"));
    pose((s) => d.setBallHoldTimer(s, 0));
    pose((s) => d.setBallServeSign(s, -1));
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.ball?.x).toBe(C.FIELD_CX);
    expect(engine.state.ball?.vx).toBeCloseTo(
      -C.SERVE_SPEED * Math.cos(C.SERVE_ANGLE),
    );
    expect(engine.state.ball?.vy).toBeLessThan(0);
    await engine.advance(1);
    expect(engine.state.ball!.x).toBeLessThan(C.FIELD_CX);
  });
  it("moves held paddles and clamps actual velocity but keeps drive velocity", async () => {
    const { engine, pose, d } = await setup(10);
    pose((s) => d.setScreen(s, "countdown"));
    pose((s) => d.setPaddleDriven(s, "left", true));
    pose((s) => d.setPaddleVy(s, "left", 1000));
    pose((s) => d.setPaddleCy(s, "left", 660));
    expect(engine.state.paddles.left.vy).toBe(0);
    await engine.advance(1);
    expect(engine.state.paddles.left).toMatchObject({
      cy: 665,
      vy: 500,
      drivenVy: 1000,
    });
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
  });
  it("maps both key pairs in Solo, independently in Versus", async () => {
    const { engine, key, pose, d } = await setup(10);
    pose((s) => d.setScreen(s, "countdown"));
    key("ArrowDown");
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(C.PADDLE_SPEED);
    pose((s) => d.setMode(s, "versus"));
    await engine.advance(1);
    expect(engine.state.paddles.left.vy).toBe(0);
    expect(engine.state.paddles.right.vy).toBe(C.PADDLE_SPEED);
  });
  it("AI senses with lag and faculties are independent", async () => {
    const { engine, pose, d, flight } = await setup(10);
    flight(700, 600, 520, 100);
    pose((s) => d.setAiMovement(s, true));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    pose((s) => d.setAiTracking(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
    pose((s) => d.setPaddleCy(s, "right", 200));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    pose((s) => d.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
  });
  it("rotates velocity with spin and exponential half life", async () => {
    const { engine, pose, d, flight } = await setup(8);
    flight(300, 350, 520, 0);
    pose((s) => d.setBallSpin(s, 800));
    await engine.advance(20);
    expect(engine.state.ball!.vy).toBeGreaterThan(0);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(520);
    expect(engine.state.ball!.spin).toBeCloseTo(
      800 * Math.pow(0.5, 0.16 / C.SPIN_HALFLIFE),
    );
    expect(engine.state.ball!.trail[0]!.t).toBeGreaterThanOrEqual(
      engine.state.simTime - C.TRAIL_TIME,
    );
  });
  it("wall bounces preserve speed and spin except decay", async () => {
    const { engine, flight } = await setup();
    flight(300, 12, 100, -500);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(500);
    flight(300, 708, 100, 500);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(-500);
  });
  it("paddle centers accelerate and impart actual movement spin", async () => {
    const { engine, pose, d, flight } = await setup(8);
    flight(79, 360, -520, 0);
    pose((s) => d.setPaddleDriven(s, "left", true));
    pose((s) => d.setPaddleVy(s, "left", 200));
    await engine.advance(2);
    expect(engine.state.ball!.vx).toBeGreaterThan(0);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(520 * C.SPEED_MULT);
    expect(engine.state.ball!.spin).toBeGreaterThan(160);
    flight(C.P2_X0 - C.BALL_R - 2, 360, 970, 0);
    await engine.advance(1);
    expect(engine.state.ball!.vx).toBeLessThan(0);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(C.SPEED_CAP);
  });
  it("paddle endcaps reflect without adding speed", async () => {
    const { engine, flight } = await setup();
    flight(56, 292, 0, 520);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(-520);
  });
  it("obstacles reflect upright and tilted faces", async () => {
    const { engine, pose, d, flight } = await setup();
    flight(466, 220, 520, 0);
    pose((s) => d.spawnObstacle(s, 0));
    pose((s) => d.setObstacleClockRunning(s, false));
    await engine.advance(2);
    expect(engine.state.ball!.vx).toBeLessThan(0);
    flight();
    pose((s) => d.setObstacleClock(s, 0.75));
    pose((s) => d.spawnObstacle(s, 0));
    const o = engine.state.obstacles[0]!;
    const nx = Math.cos(o.theta),
      ny = Math.sin(o.theta);
    pose((s) =>
      d.setBallPosition(
        s,
        o.cx - (C.OBSTACLE_HW + C.BALL_R + 2) * nx,
        o.cy - (C.OBSTACLE_HW + C.BALL_R + 2) * ny,
      ),
    );
    pose((s) => d.setBallVelocity(s, 520 * nx, 520 * ny));
    await engine.advance(2);
    expect(
      engine.state.ball!.vx * nx + engine.state.ball!.vy * ny,
    ).toBeLessThan(0);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(520);
  });
  it("scores only after full goal crossing, parks toward the loser", async () => {
    const { engine, flight } = await setup();
    flight(C.FIELD_W + C.BALL_R - 1, 100, 520, 0);
    await engine.advance(1);
    expect(engine.state.score.p1).toBe(1);
    expect(engine.state.receiver).toBe("right");
    expect(engine.state.ball).toMatchObject({ held: true, spin: 0, trail: [] });
    flight(-C.BALL_R + 1, 100, -520, 0);
    await engine.advance(1);
    expect(engine.state.score.p2).toBe(1);
  });
  it("plays deuce and ends only with a two-point lead", async () => {
    const { engine, pose, d, flight, tap } = await setup();
    pose((s) => d.setScore(s, 10, 10));
    flight(1292, 100, 520, 0);
    await engine.advance(1);
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.score.p1).toBe(11);
    flight(1292, 100, 520, 0);
    await engine.advance(1);
    expect(engine.state.screen).toBe("matchover");
    expect(engine.state.winner).toBe("left");
    await tap("Enter");
    expect(engine.state.score.p1).toBe(0);
    pose((s) => d.setScore(s, 0, 10));
    flight(-12, 100, -520, 0);
    await engine.advance(1);
    expect(engine.state.winner).toBe("right");
    await tap("Escape");
    expect(engine.state.screen).toBe("title");
  });
  it("agrees across 2ms and 16ms steps through spin and a paddle contact", async () => {
    const results = [];
    for (const step of [2, 16]) {
      const { engine, flight, pose, d } = await setup(step);
      flight(180, 340, -520, 0);
      pose((s) => d.setBallSpin(s, 120));
      await engine.advance(800 / step);
      results.push(engine.state.ball!);
    }
    expect(
      Math.abs(
        Math.hypot(results[0]!.vx, results[0]!.vy) -
          Math.hypot(results[1]!.vx, results[1]!.vy),
      ),
    ).toBeLessThan(10);
    expect(Math.sign(results[0]!.vx)).toBe(Math.sign(results[1]!.vx));
    expect(Math.sign(results[0]!.vy)).toBe(Math.sign(results[1]!.vy));
  });
});

describe("edge cases", () => {
  it("parks with a fresh unbiased sign draw and preserves posed signs until parking", async () => {
    const { engine, pose, d } = await setup();
    const random = vi.spyOn(Math, "random");
    try {
      random.mockReturnValue(0.25);
      pose((s) => d.spawnBall(s));
      expect(engine.state.ball!.serveSign).toBe(-1);
      random.mockReturnValue(0.75);
      pose((s) => d.drawBallServeSign(s));
      expect(engine.state.ball!.serveSign).toBe(1);
      const posed = engine.state;
      pose((s) => d.setBallServeSign(s, -1));
      expect(posed.ball!.serveSign).toBe(1);
      pose((s) => d.setScreen(s, "countdown"));
      await engine.advance(2);
      expect(engine.state.ball!.serveSign).toBe(-1);
    } finally {
      random.mockRestore();
    }
  });
  it("keeps sway point-symmetric and advances its clock only in live screens", async () => {
    const { engine, pose, d } = await setup();
    pose((s) => d.setObstacleClock(s, 0.5));
    const before = engine.state.obstacles;
    await engine.advance(3);
    expect(engine.state.obstacles).toEqual(before);
    pose((s) => d.setScreen(s, "playing"));
    await engine.advance(1);
    expect(engine.state.obstacleClock).toBeCloseTo(0.508);
    const [a, b] = engine.state.obstacles;
    expect(a!.cy + b!.cy).toBeCloseTo(C.FIELD_H);
    pose((s) => d.setObstacleClockRunning(s, false));
    await engine.advance(5);
    expect(engine.state.obstacleClock).toBeCloseTo(0.508);
  });
  it("resolves obstacle corners and deeply embedded centers even with zero speed", async () => {
    const { engine, pose, d, flight } = await setup();
    flight(474, 144, 300, 300);
    pose((s) => d.spawnObstacle(s, 0));
    pose((s) => d.setObstacleClockRunning(s, false));
    await engine.advance(1);
    expect(engine.state.ball!.vx).toBeLessThan(0);
    expect(engine.state.ball!.vy).toBeLessThan(0);
    pose((s) => d.setBallPosition(s, 490, 220));
    pose((s) => d.setBallVelocity(s, 0, 0));
    await engine.advance(1);
    expect(engine.state.ball!.x).toBeGreaterThanOrEqual(511);
    expect(engine.state.ball!.vx).toBe(0);
  });
  it("honors keyboard confirm over a simultaneous pointer confirm", async () => {
    const { engine, d, key, pointer } = await setup();
    const r = d.menuItemRect(engine.state, 1)!;
    key("Enter");
    pointer("down", r.x + 20, r.y + 20);
    pointer("up", r.x + 20, r.y + 20);
    await engine.advance(1);
    expect(engine.state.mode).toBe("solo");
    expect(engine.state.titleIndex).toBe(0);
  });
  it("counts each cue at most once per update, including huge substep counts", async () => {
    const { engine, flight } = await setup(1000);
    flight(640, 12, 0, -C.SPEED_CAP);
    const cues: string[] = [];
    engine.events.on("cue:played", (e) => cues.push(e.cue));
    await engine.advance(1);
    expect(cues.filter((c) => c === C.CUES.wallBounce)).toHaveLength(1);
  });
});

describe("debug contract and recording", () => {
  it("poses each field without touching unrelated values", async () => {
    const { engine, pose, d } = await setup();
    pose((s) => d.setMode(s, "versus"));
    pose((s) => d.setMenuIndex(s, 2));
    pose((s) => d.setTitleIndex(s, 1));
    pose((s) => d.setResumeScreen(s, "countdown"));
    pose((s) => d.setWinner(s, "right"));
    pose((s) => d.setReceiver(s, "right"));
    pose((s) => d.setObstacleClock(s, 1.2));
    pose((s) => d.setObstacleClockRunning(s, false));
    pose((s) => d.setBallServeSign(s, 1));
    pose((s) => d.setBallVelocity(s, 3, 4));
    const before = d.snapshot(engine.state);
    expect(before.ball!.speed).toBe(5);
    expect(before.obstacles[0]!.theta).toBeCloseTo(C.OBSTACLE_SPIN_RATE * 1.2);
    expect(d.reconcile(engine.state)).toEqual(engine.state);
    pose((s) => d.drawBallServeSign(s));
    expect([-1, 1]).toContain(engine.state.ball!.serveSign);
    pose((s) => d.setMuted(s, true));
    pose((s) => d.reset(s));
    expect(engine.state).toMatchObject({
      screen: "title",
      muted: true,
      simTime: 0,
      titleIndex: 0,
      menuIndex: 0,
      obstacleClock: 0,
    });
    expect(d.menuItemRect(engine.state, -1)).toBeNull();
    expect(d.menuItemRect(engine.state, 99)).toBeNull();
    pose((s) => d.setScreen(s, "playing"));
    expect(d.menuItemRect(engine.state, 0)).toBeNull();
  });
  it("absent entities neither draw, collide nor score; bad poses throw", async () => {
    const { engine, pose, d } = await setup();
    pose((s) => d.clearWorld(s));
    expect(() => pose((s) => d.setBallSpin(s, 3))).toThrow("No ball");
    expect(() => pose((s) => d.drawBallServeSign(s))).toThrow("No ball");
    expect(() => pose((s) => d.spawnObstacle(s, 2))).toThrow(
      "Unknown obstacle",
    );
    pose((s) => d.setScreen(s, "playing"));
    await engine.advance(10);
    expect(engine.state.ball).toBeNull();
    expect(engine.state.obstacles).toEqual([]);
    pose((s) => d.spawnObstacle(s, 1));
    pose((s) => d.spawnObstacle(s, 0));
    pose((s) => d.spawnObstacle(s, 1));
    expect(engine.state.obstacles.map((o) => o.index)).toEqual([0, 1]);
  });
  it("records actual draw commands for all screens", async () => {
    const { engine, pose, d } = await setup();
    engine.startRecording();
    for (const screen of [
      "title",
      "howto",
      "countdown",
      "playing",
      "paused",
      "matchover",
    ] as const) {
      pose((s) => d.setScreen(s, screen));
      await engine.advance(1);
    }
    const recording = engine.stopRecording();
    expect(recording.frames).toHaveLength(6);
    expect(
      recording.ops.some((o) => o.op === "call" && o.method === "fillText"),
    ).toBe(true);
    expect(recording.frames.every((f) => !f.truncated)).toBe(true);
  });
});
