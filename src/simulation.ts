import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type {
  BallState,
  CaromState,
  ObstacleState,
  PaddleState,
  ReadState,
  Side,
} from "./game";
import { clamp, obstaclePose, parkedBall } from "./world";

type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };
type CueSet = Set<C.CueName>;

function movePaddle(p: PaddleState, vy: number, dt: number): PaddleState {
  const raw = p.cy + vy * dt;
  const cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return { ...p, cy, vy: raw !== cy && dt > 0 ? (cy - p.cy) / dt : vy };
}
function paddleVelocity(
  s: ReadState,
  side: Side,
  input: UpdateApi["input"],
  dt: number,
): number {
  const p = s.paddles[side];
  if (p.driven) return p.drivenVy;
  if (side === "right" && s.mode === "solo") {
    if (!s.ai.movement) return 0;
    let target = C.AI_HOME_Y;
    let deadzone = C.AI_HOME_DEADZONE;
    if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
      target = s.ball.y - s.ball.vy * C.AI_REACT;
      deadzone = C.AI_DEADZONE;
    }
    const diff = target - p.cy;
    return Math.abs(diff) <= deadzone || dt <= 0
      ? 0
      : Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
  }
  const both = s.mode === "solo";
  const up = both
    ? Math.max(input.value("p1-up"), input.value("p2-up"))
    : input.value(side === "left" ? "p1-up" : "p2-up");
  const down = both
    ? Math.max(input.value("p1-down"), input.value("p2-down"))
    : input.value(side === "left" ? "p1-down" : "p2-down");
  return (down - up) * C.PADDLE_SPEED;
}

function paddleContact(
  b: MovingBall,
  p: PaddleState,
  side: Side,
  cues: CueSet,
): void {
  const x0 = side === "left" ? C.P1_X0 : C.P2_X0;
  const x1 = side === "left" ? C.P1_X1 : C.P2_X1;
  const y0 = p.cy - C.PADDLE_HALF;
  const y1 = p.cy + C.PADDLE_HALF;
  if (!(
    b.x > x0 - C.BALL_R &&
    b.x < x1 + C.BALL_R &&
    b.y > y0 - C.BALL_R &&
    b.y < y1 + C.BALL_R
  ))
    return;
  const depths = [
    b.x - (x0 - C.BALL_R),
    x1 + C.BALL_R - b.x,
    b.y - (y0 - C.BALL_R),
    y1 + C.BALL_R - b.y,
  ];
  const face = depths.indexOf(Math.min(...depths));
  if (face < 2) {
    const angle =
      clamp((b.y - p.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
    const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
    b.vx = (side === "left" ? 1 : -1) * speed * Math.cos(angle);
    b.vy = speed * Math.sin(angle);
    b.spin = clamp(
      b.spin + p.vy * C.SPIN_FROM_PADDLE,
      -C.SPIN_CLAMP,
      C.SPIN_CLAMP,
    );
    b.x = side === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
    cues.add(C.CUES.paddleHit);
  } else {
    b.y = face === 2 ? y0 - C.BALL_R : y1 + C.BALL_R;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
  }
}
function obstacleContact(b: MovingBall, o: ObstacleState, cues: CueSet): void {
  const c = Math.cos(o.theta),
    s = Math.sin(o.theta);
  const dx = b.x - o.cx,
    dy = b.y - o.cy;
  const lx = dx * c + dy * s,
    ly = -dx * s + dy * c;
  const qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW);
  const qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const dist = Math.hypot(lx - qx, ly - qy);
  if (dist >= C.BALL_R) return;
  let nx: number, ny: number, push: number;
  if (dist > 0) {
    nx = (lx - qx) / dist;
    ny = (ly - qy) / dist;
    push = C.BALL_R - dist;
  } else {
    const px = C.OBSTACLE_HW - Math.abs(lx),
      py = C.OBSTACLE_HH - Math.abs(ly);
    nx = px <= py ? (lx >= 0 ? 1 : -1) : 0;
    ny = px <= py ? 0 : ly >= 0 ? 1 : -1;
    push = C.BALL_R + Math.min(px, py);
  }
  const wx = nx * c - ny * s,
    wy = nx * s + ny * c;
  const dot = b.vx * wx + b.vy * wy;
  if (dot < 0) {
    b.vx -= 2 * dot * wx;
    b.vy -= 2 * dot * wy;
    cues.add(C.CUES.obstacleBounce);
  }
  b.x += wx * (push + 1e-8);
  b.y += wy * (push + 1e-8);
}

function fly(
  ball: BallState,
  s: ReadState,
  dt: number,
  cues: CueSet,
): BallState {
  const b: MovingBall = { ...ball };
  const n = Math.max(
    1,
    Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
  );
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const angle = (b.spin / speed) * h;
      const c = Math.cos(angle),
        sn = Math.sin(angle);
      const vx = b.vx * c - b.vy * sn;
      b.vy = b.vx * sn + b.vy * c;
      b.vx = vx;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    paddleContact(b, s.paddles.left, "left", cues);
    paddleContact(b, s.paddles.right, "right", cues);
    for (const obstacle of s.obstacles) obstacleContact(b, obstacle, cues);
  }
  return b;
}

export function advanceMatch(
  s: ReadState,
  input: UpdateApi["input"],
  dt: number,
  cues: CueSet,
): CaromState {
  let next: CaromState = {
    ...s,
    paddles: {
      left: movePaddle(
        s.paddles.left,
        paddleVelocity(s, "left", input, dt),
        dt,
      ),
      right: movePaddle(
        s.paddles.right,
        paddleVelocity(s, "right", input, dt),
        dt,
      ),
    },
  };
  let ball = s.ball;
  if (ball) {
    if (ball.held) {
      const holdTimer = Math.max(0, ball.holdTimer - dt);
      ball = { ...ball, holdTimer };
      if (holdTimer <= 0) {
        ball = {
          ...ball,
          held: false,
          trail: [],
          vx:
            (s.receiver === "left" ? -1 : 1) *
            C.SERVE_SPEED *
            Math.cos(C.SERVE_ANGLE),
          vy: ball.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
        };
        next = { ...next, screen: "playing" };
      }
    } else if (s.screen === "playing") ball = fly(ball, next, dt, cues);
    ball = {
      ...ball,
      trail: [
        ...ball.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
        { x: ball.x, y: ball.y, t: s.simTime },
      ],
    };
    next = { ...next, ball };
    if (
      !ball.held &&
      (ball.x - C.BALL_R > C.FIELD_W || ball.x + C.BALL_R < 0)
    ) {
      const scorer = ball.x > C.FIELD_CX ? "left" : "right";
      const score = {
        p1: s.score.p1 + (scorer === "left" ? 1 : 0),
        p2: s.score.p2 + (scorer === "right" ? 1 : 0),
      };
      const won =
        Math.max(score.p1, score.p2) >= C.WIN_SCORE &&
        Math.abs(score.p1 - score.p2) >= C.WIN_LEAD;
      next = {
        ...next,
        score,
        ...(won
          ? { screen: "matchover" as const, winner: scorer, menuIndex: 0 }
          : {
              screen: "countdown" as const,
              receiver:
                scorer === "left" ? ("right" as const) : ("left" as const),
              ball: parkedBall(),
            }),
      };
      cues.add(C.CUES.score);
    }
  }
  const obstacleClock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  return {
    ...next,
    obstacleClock,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, obstacleClock)),
  };
}
