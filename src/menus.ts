import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CaromState, MenuRect, ReadState } from "./game";
import { returnTitle, startMatch } from "./world";

export function menuItems(s: ReadState): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    default:
      return [];
  }
}
export function menuItemRect(s: ReadState, index: number): MenuRect | null {
  if (!Number.isInteger(index) || index < 0 || index >= menuItems(s).length)
    return null;
  if (s.screen === "title")
    return { x: 112, y: 366 + index * 66, w: 410, h: 54 };
  if (s.screen === "howto") return { x: 112, y: 598, w: 340, h: 54 };
  return {
    x: 445,
    y: (s.screen === "matchover" ? 430 : 328) + index * 66,
    w: 390,
    h: 54,
  };
}
function itemAt(s: ReadState, x: number, y: number): number {
  return menuItems(s).findIndex((_, i) => {
    const r = menuItemRect(s, i);
    return (
      r !== null && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
    );
  });
}
function confirm(s: ReadState): CaromState {
  switch (s.screen) {
    case "title": {
      const next = { ...s, titleIndex: s.menuIndex, menuPress: {} };
      return s.menuIndex === 2
        ? { ...next, screen: "howto", menuIndex: 0 }
        : startMatch(next, s.menuIndex === 1 ? "versus" : "solo");
    }
    case "howto":
      return returnTitle(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen, menuPress: {} }
        : s.menuIndex === 1
          ? startMatch(s, s.mode)
          : returnTitle(s);
    case "matchover":
      return s.menuIndex === 0 ? startMatch(s, s.mode) : returnTitle(s);
    default:
      return { ...s };
  }
}
export function readMenus(
  s: ReadState,
  input: UpdateApi["input"],
  edges: Record<C.ActionName, boolean>,
): CaromState {
  // Snapshot every pointer channel in this same input read, before interpreting it.
  input.pointer();
  const samples = input.pointerSamples();
  const contacts = input.pointerContacts();
  if (s.screen === "playing" || s.screen === "countdown") {
    return edges.pause
      ? {
          ...s,
          resumeScreen: s.screen,
          screen: "paused",
          menuIndex: 0,
          menuPress: {},
        }
      : { ...s };
  }
  if (s.screen === "paused" && (edges.pause || edges.back))
    return { ...s, screen: s.resumeScreen, menuPress: {} };
  if ((s.screen === "howto" || s.screen === "matchover") && edges.back)
    return returnTitle(s);
  const count = menuItems(s).length;
  const up = edges["p1-up"] || edges["p2-up"];
  const down = edges["p1-down"] || edges["p2-down"];
  let next: CaromState = { ...s };
  let keyboardConfirmed = false;
  if (count > 0 && (up || down))
    next = { ...next, menuIndex: (s.menuIndex + (up ? count - 1 : 1)) % count };
  else if (edges.confirm) {
    next = confirm(next);
    keyboardConfirmed = true;
  }
  // A screen reached by a keyboard confirm must not read input a second time.
  if (next.screen !== s.screen || keyboardConfirmed) return next;
  const presses = { ...s.menuPress };
  let selected = next.menuIndex;
  let confirmed = false;
  for (const sample of samples) {
    const index = itemAt(s, sample.x, sample.y);
    if (index >= 0) selected = index;
    if (sample.type === "down" && sample.button === "primary")
      presses[sample.id] = index;
    if (sample.type === "up") {
      if (index >= 0 && presses[sample.id] === index && !confirmed) {
        selected = index;
        confirmed = true;
      }
      delete presses[sample.id];
    }
  }
  if (!confirmed)
    for (const contact of contacts) {
      const index = itemAt(s, contact.x, contact.y);
      if (index >= 0) selected = index;
    }
  next = { ...next, menuIndex: selected, menuPress: presses };
  return confirmed ? confirm(next) : next;
}
