# Carom

**A paddle duel with a twist.** Strike while moving to curve the ball, find a bank
shot off the swaying, rotating obstacles, and slip a shot past your opponent.
Play Solo against the machine or Versus with a friend on the same keyboard.
First to 11 wins, with a two-point lead required.

Everything is drawn and synthesized in code. There are no external assets,
services, accounts, or runtime downloads. The Simple 2D engine handles the clock,
canvas fit, input, touch controls, audio, diagnostics, and draw-command recording.

## Run locally

Requires a current Node.js version supported by Vite (Node 22.12+ or 24).

```sh
npm ci
npm run dev
```

Open the development URL printed by Vite.

## Production

```sh
npm ci
npm run build
```

Serve `dist/` from any static web server. Its root `index.html` is the entry
point; no server-side application is needed. `npm run preview` serves the build
locally on port 4173.

## Controls

| Input | Action |
| --- | --- |
| W / S | Left paddle up / down |
| ↑ / ↓ | Right paddle up / down; also controls the left paddle in Solo |
| W / S or ↑ / ↓ | Navigate menus |
| Enter / Space | Confirm selected item |
| P / Escape | Pause / resume |
| Escape | Back from instructions or results |
| M | Toggle sound |
| Backtick | Engine diagnostics overlay |

Menus also accept mouse and touch. Touching the game reveals the engine's two
vertical paddle sliders and menu buttons. The whole field stays visible at any
window size, with letterboxing as needed.

Move your paddle **at contact** to add spin. An edge hit changes the outgoing
angle, and each paddle hit increases speed. Spin fades during flight, but wall
and obstacle bounces preserve it. Aim for the obstacle's current face, not where
it was a moment ago.

## Code and tests

- `src/game.ts`: exported state contract, initialization, update orchestration.
- `src/simulation.ts`: render-free paddle, ball, collision, and scoring logic.
- `src/world.ts`: parking, obstacle poses, and screen reset helpers.
- `src/menus.ts`: keyboard, pointer, and touch menu transitions and hit regions.
- `src/debug.ts`: state-in/state-out automation surface returned by the engine.
- `src/render.ts`: canvas-only presentation.
- `src/game.test.ts`: engine-driven tests using an in-process canvas and counted
  frames, including step-size agreement, collisions, spin, AI, and menus.

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The debug API is available only through an engine handle: apply poses with
`engine.apply(s => engine.debug.setBallSpin(s, 400))` and read with
`engine.debug.snapshot(engine.state)`. Nothing is installed on the page.

## Showcase

See [`showcase/showcase.md`](showcase/showcase.md) and
[`showcase/showcase.toml`](showcase/showcase.toml). The PNGs are captures of the
running browser game. `rally.json.gz` contains seven seconds of actual engine
recording: a curved rally with paddle, wall, and obstacle bounces. It is a gzip
of the unmodified recording returned by `engine.stopRecording()`, not video or
a hand-authored animation.
