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
  if (player.wallReady)
    return {
      title: "AT THE WALL",
      detail: "Waiting for the strike",
      descend: false,
    };
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
    return {
      title: "SETTLING ON THE BOTTOM",
      detail: "Leveling out for puck work",
      descend: false,
    };
  return {
    title:
      player.position.y >= SURFACE_HEIGHT - 0.045
        ? "AT THE SURFACE"
        : "OFF THE BOTTOM",
    detail:
      player.position.y >= SURFACE_HEIGHT - 0.045
        ? "Hold Space to look above water"
        : `${Math.max(0, player.position.y - FLOOR_HEIGHT).toFixed(1)} m above the bottom`,
    descend: true,
  };
};
