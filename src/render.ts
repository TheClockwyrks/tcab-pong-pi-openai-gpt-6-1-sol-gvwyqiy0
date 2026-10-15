import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { ReadState } from "./game";
import { menuItemRect, menuItems } from "./menus";

const INK = "#edf3ee";
const DIM = "#788695";
const GREEN = "#c5f277";
const CORAL = "#ff947f";
const PURPLE = "#a59aff";

function text(
  ctx: CanvasRenderingContext2D,
  copy: string,
  x: number,
  y: number,
  size = 14,
  color = DIM,
  align: CanvasTextAlign = "left",
  weight = 500,
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${size < 18 ? '"Courier New", monospace' : "Arial, sans-serif"}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(copy, x, y);
}
function line(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color = "#23303d",
  width = 1,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w / 2, 6));
  ctx.fill();
}
function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function base(ctx: CanvasRenderingContext2D): void {
  const glow = ctx.createRadialGradient(790, 320, 30, 790, 320, 750);
  glow.addColorStop(0, "#14232c");
  glow.addColorStop(1, "#090f19");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  for (let x = 32; x < C.FIELD_W; x += 48)
    for (let y = 24; y < C.FIELD_H; y += 48) {
      ctx.fillStyle = "#263640";
      ctx.globalAlpha = 0.45;
      ctx.fillRect(x, y, 1, 1);
    }
  ctx.globalAlpha = 1;
}
function footer(ctx: CanvasRenderingContext2D, s: ReadState): void {
  text(ctx, "W / S   ↑ / ↓  MOVE", 40, 688, 12);
  text(ctx, "P / ESC  PAUSE", C.FIELD_CX, 688, 12, DIM, "center");
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    1240,
    688,
    12,
    DIM,
    "right",
  );
}
function buttons(ctx: CanvasRenderingContext2D, s: ReadState): void {
  menuItems(s).forEach((copy, i) => {
    const r = menuItemRect(s, i);
    if (!r) return;
    const active = i === s.menuIndex;
    ctx.fillStyle = active ? GREEN : "#111d28";
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 4);
    ctx.fill();
    if (!active) {
      ctx.strokeStyle = "#2b3943";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    text(
      ctx,
      `0${i + 1}`,
      r.x + 20,
      r.y + r.h / 2,
      12,
      active ? "#4c6333" : DIM,
    );
    text(
      ctx,
      copy,
      r.x + 62,
      r.y + r.h / 2,
      17,
      active ? "#172317" : INK,
      "left",
      700,
    );
    text(
      ctx,
      active ? "↗" : "+",
      r.x + r.w - 25,
      r.y + r.h / 2,
      23,
      active ? "#172317" : DIM,
      "center",
    );
  });
}
function title(ctx: CanvasRenderingContext2D, s: ReadState): void {
  text(ctx, "C / 01", 112, 86, 14, GREEN);
  text(ctx, "AN ANGLE CHANGES EVERYTHING", 1240, 86, 12, DIM, "right");
  line(ctx, 112, 117, 1168, 117);
  text(ctx, "THE PADDLE DUEL, WITH A TWIST.", 112, 186, 13, GREEN);
  ctx.save();
  ctx.translate(103, 275);
  ctx.transform(1, 0, -0.12, 1, 0, 0);
  text(ctx, C.TITLE_TEXT, 0, 0, 112, INK, "left", 900);
  ctx.restore();
  text(ctx, "Find your angle. Put a little spin on it.", 112, 321, 17, DIM);
  buttons(ctx, s);
  text(ctx, "W / S OR ↑ / ↓  SELECT     ENTER  PLAY", 112, 601, 12, DIM);
  text(
    ctx,
    `LOCAL PLAY  /  FIRST TO ${C.WIN_SCORE}, WIN BY ${C.WIN_LEAD}`,
    112,
    630,
    12,
    DIM,
  );
  // A diagram of a bank shot: deliberately composed, not an advancing demo.
  ctx.save();
  ctx.translate(710, 195);
  ctx.strokeStyle = "#2c3b43";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0, 0, 458, 388, 14);
  ctx.stroke();
  text(ctx, "THE ART OF THE REBOUND", 24, 29, 11, DIM);
  text(ctx, "↗", 431, 29, 19, GREEN, "right");
  line(ctx, 24, 50, 434, 50);
  ctx.setLineDash([5, 10]);
  line(ctx, 229, 72, 229, 345, "#2c3b43");
  ctx.setLineDash([]);
  ctx.strokeStyle = "#3a5148";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(52, 281);
  ctx.bezierCurveTo(145, 240, 92, 109, 206, 146);
  ctx.lineTo(353, 255);
  ctx.stroke();
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(206, 146);
  ctx.bezierCurveTo(253, 120, 301, 123, 348, 168);
  ctx.stroke();
  for (let i = 0; i < 7; i++)
    dot(
      ctx,
      348 - i * 5,
      168 - i * 3,
      8 - i * 0.8,
      `rgba(197,242,119,${0.7 - i * 0.09})`,
    );
  dot(ctx, 354, 173, 9, INK);
  bar(ctx, 36, 244, 10, 66, GREEN);
  bar(ctx, 411, 124, 10, 66, CORAL);
  ctx.save();
  ctx.translate(196, 155);
  ctx.rotate(-0.55);
  bar(ctx, -7, -43, 14, 86, PURPLE);
  ctx.restore();
  ctx.save();
  ctx.translate(278, 290);
  ctx.rotate(0.7);
  bar(ctx, -7, -43, 14, 86, PURPLE);
  ctx.restore();
  text(ctx, "01  MOVE", 24, 362, 10, GREEN);
  text(ctx, "02  SPIN", 172, 362, 10, PURPLE);
  text(ctx, "03  BANK", 322, 362, 10, CORAL);
  ctx.restore();
  text(ctx, "NO STRAIGHT ANSWERS.", 939, 625, 12, DIM, "center");
  line(ctx, 112, 663, 1168, 663);
  text(ctx, "CAROM / A GAME OF MOTION & MISDIRECTION", 112, 689, 10, DIM);
  text(
    ctx,
    s.muted ? "M  SOUND OFF" : "M  SOUND ON",
    1168,
    689,
    10,
    DIM,
    "right",
  );
}
function field(ctx: CanvasRenderingContext2D, s: ReadState): void {
  // Court markings stay subordinate to every collision body.
  ctx.setLineDash([8, 14]);
  line(ctx, C.NET_X, 0, C.NET_X, C.FIELD_H, "#2a3843");
  ctx.setLineDash([]);
  ctx.strokeStyle = "#20313b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 86, 0, Math.PI * 2);
  ctx.stroke();
  line(ctx, 0, 1, C.FIELD_W, 1, "#526258", 2);
  line(ctx, 0, C.FIELD_H - 1, C.FIELD_W, C.FIELD_H - 1, "#526258", 2);
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.shadowColor = PURPLE;
    ctx.shadowBlur = 16;
    bar(
      ctx,
      -C.OBSTACLE_HW,
      -C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_H,
      PURPLE,
    );
    ctx.shadowBlur = 0;
    line(ctx, -3, -12, 3, -12, "#675cbb", 2);
    line(ctx, -3, 0, 3, 0, "#675cbb", 2);
    line(ctx, -3, 12, 3, 12, "#675cbb", 2);
    ctx.restore();
  }
  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? C.P1_X0 : C.P2_X0;
    const color = side === "left" ? GREEN : CORAL;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    bar(
      ctx,
      x,
      s.paddles[side].cy - C.PADDLE_HALF,
      C.PADDLE_W,
      C.PADDLE_H,
      color,
    );
    ctx.shadowBlur = 0;
  }
  const ball = s.ball;
  if (ball) {
    ctx.lineCap = "round";
    for (let i = 1; i < ball.trail.length; i++) {
      const a = ball.trail[i - 1],
        b = ball.trail[i];
      if (!a || !b) continue;
      const age = Math.max(0, 1 - (s.simTime - b.t) / C.TRAIL_TIME);
      line(
        ctx,
        a.x,
        a.y,
        b.x,
        b.y,
        `rgba(226,244,213,${age * 0.5})`,
        C.BALL_R * 2 * age,
      );
    }
    ctx.shadowBlur = 20;
    ctx.shadowColor = INK;
    dot(ctx, ball.x, ball.y, C.BALL_R, INK);
    ctx.shadowBlur = 0;
    if (Math.abs(ball.spin) > 40 && !ball.held) {
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        ball.x,
        ball.y,
        C.BALL_R + 6,
        s.simTime * 8,
        s.simTime * 8 + Math.PI * 1.2,
      );
      ctx.stroke();
    }
  }
  // Scoreboard is a compact broadcast-style plate.
  ctx.fillStyle = "#090f19e8";
  ctx.fillRect(424, 12, 432, 100);
  text(ctx, "P1", 474, 39, 11, GREEN, "center");
  text(ctx, s.mode === "solo" ? "CPU" : "P2", 806, 39, 11, CORAL, "center");
  text(
    ctx,
    String(s.score.p1).padStart(2, "0"),
    534,
    65,
    48,
    GREEN,
    "center",
    700,
  );
  text(
    ctx,
    String(s.score.p2).padStart(2, "0"),
    746,
    65,
    48,
    CORAL,
    "center",
    700,
  );
  text(ctx, "/", C.FIELD_CX, 66, 24, "#3b4b55", "center");
  text(
    ctx,
    s.mode === "solo" ? "SOLO / HUMAN vs MACHINE" : "VERSUS / LOCAL DUEL",
    C.FIELD_CX,
    127,
    11,
    DIM,
    "center",
  );
  if (s.screen === "countdown") {
    text(ctx, "READY", C.FIELD_CX, 285, 13, GREEN, "center", 700);
    text(
      ctx,
      `SERVE ${s.receiver === "left" ? "←" : "→"}`,
      C.FIELD_CX,
      432,
      12,
      INK,
      "center",
    );
    const progress = ball ? 1 - ball.holdTimer / C.HOLD_TIME : 0;
    line(ctx, 590, 461, 690, 461, "#27363f", 3);
    line(ctx, 590, 461, 590 + 100 * progress, 461, GREEN, 3);
  }
  footer(ctx, s);
}
function howto(ctx: CanvasRenderingContext2D, s: ReadState): void {
  text(ctx, "C / FIELD NOTES", 112, 85, 14, GREEN);
  text(ctx, "PLAY THE ANGLES.", 112, 166, 52, INK, "left", 800);
  text(ctx, "A simple duel. A beautifully crooked ball.", 112, 219, 19, DIM);
  const cards = [
    {
      x: 112,
      n: "01",
      name: "MOVE",
      color: GREEN,
      lines: [
        "W / S — left paddle",
        "↑ / ↓ — right paddle",
        "Solo: either pair is yours.",
      ],
    },
    {
      x: 480,
      n: "02",
      name: "SPIN",
      color: INK,
      lines: [
        "Move as you strike the ball.",
        "Up bends it. Down bends it.",
        "Edge hits make sharper angles.",
      ],
    },
    {
      x: 848,
      n: "03",
      name: "BANK",
      color: PURPLE,
      lines: [
        "The obstacles sway and turn.",
        "Use their faces for bank shots.",
        "Score past the far paddle.",
      ],
    },
  ];
  for (const card of cards) {
    line(ctx, card.x, 288, card.x + 320, 288, card.color, 2);
    text(ctx, card.n, card.x, 325, 13, card.color);
    text(ctx, card.name, card.x, 370, 32, card.color, "left", 700);
    card.lines.forEach((copy, i) =>
      text(ctx, copy, card.x, 424 + i * 29, 15, DIM),
    );
  }
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE} · LEAD BY ${C.WIN_LEAD}     /     P OR ESC: PAUSE     /     M: MUTE`,
    112,
    550,
    13,
    INK,
  );
  buttons(ctx, s);
}
export function render(s: ReadState, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.save();
  base(ctx);
  if (s.screen === "title") title(ctx, s);
  else if (s.screen === "howto") howto(ctx, s);
  else {
    field(ctx, s);
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "#090f19df";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      line(ctx, 445, 182, 835, 182, GREEN, 2);
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATH" : "THE FINAL ANGLE",
        C.FIELD_CX,
        220,
        12,
        GREEN,
        "center",
      );
      text(
        ctx,
        s.screen === "paused"
          ? "PAUSED"
          : s.winner === "left"
            ? "PLAYER 1 WINS"
            : s.mode === "solo"
              ? "MACHINE WINS"
              : "PLAYER 2 WINS",
        C.FIELD_CX,
        275,
        s.screen === "paused" ? 52 : 44,
        INK,
        "center",
        800,
      );
      if (s.screen === "matchover")
        text(
          ctx,
          `${s.score.p1}  —  ${s.score.p2}`,
          C.FIELD_CX,
          359,
          50,
          INK,
          "center",
          700,
        );
      buttons(ctx, s);
      text(
        ctx,
        "↑ / ↓  SELECT     ENTER  CONFIRM",
        C.FIELD_CX,
        590,
        11,
        DIM,
        "center",
      );
    }
  }
  ctx.restore();
}
