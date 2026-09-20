import { FLOOR_HEIGHT, type Player, SURFACE_HEIGHT } from "./types";

export const atPlayingDepth = (player: Player): boolean =>
  !player.wallReady &&
  !player.emergency &&
  player.mode !== "ascending" &&
  player.mode !== "recovering" &&
  player.position.y <= FLOOR_HEIGHT + 0.06 &&
  Math.abs(player.bodyPitch) < 0.18;

export type DepthGuidance = {
  title: string;
  detail: string;
  descend: boolean;
};

export const depthGuidance = (player: Player): DepthGuidance | undefined => {
  if (atPlayingDepth(player)) return undefined;
  if (player.wallReady) return undefined;
  if (player.emergency || (player.mode === "recovering" && player.air <= 8))
    return {
      title: "RECOVER YOUR BREATH",
      detail:
        player.position.y >= SURFACE_HEIGHT - 0.045
          ? "Catch your breath before diving again"
          : "Surfacing for air",
      descend: false,
    };
  if (player.position.y <= FLOOR_HEIGHT + 0.06 && player.mode !== "ascending")
    return undefined;
  if (player.position.y >= SURFACE_HEIGHT - 0.045) return undefined;
  const heightAboveBottom = Math.max(0, player.position.y - FLOOR_HEIGHT);
  if (heightAboveBottom + 1e-6 >= 1) return undefined;
  return {
    title: "OFF THE BOTTOM",
    detail: `${heightAboveBottom.toFixed(1)} m above bottom`,
    descend: true,
  };
};
