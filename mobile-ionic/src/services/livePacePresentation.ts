import type { LivePaceState } from "./livePace";

const captions: Record<LivePaceState, string> = {
  moving: "min/km • à cet instant",
  stopped: "À l'arrêt",
  unavailable: "Signal GPS indisponible",
  paused: "En pause",
  inactive: "min/km",
};

export function getLivePaceCaption(state: LivePaceState): string {
  return captions[state];
}
