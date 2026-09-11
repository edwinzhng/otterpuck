import { clamp, type Player, SURFACE_HEIGHT } from "./types";

export const headLiftTarget = (player: Player, risingHeld: boolean): number =>
  risingHeld && player.position.y >= SURFACE_HEIGHT - 0.045 ? 0.36 : 0;

export const approachHeadLift = (
  current: number,
  target: number,
  dt: number,
): number =>
  current + (target - current) * (1 - Math.exp(-Math.max(0, dt) * 9));

export const speedLineIntensity = (speed: number): number =>
  clamp((speed - 1.55) / 1.35, 0, 1) * 0.5;

export const createSpeedLines = (): ((
  speed: number,
  visible: boolean,
  dt: number,
) => void) => {
  const overlay = document.createElement("div");
  overlay.className = "speed-lines";
  overlay.setAttribute("aria-hidden", "true");
  for (const side of [-1, 1])
    for (const index of [0, 1, 2, 3, 4, 5]) {
      const streak = document.createElement("i");
      streak.style.setProperty("--side", String(side));
      streak.style.setProperty("--angle", `${(index - 2.5) * 12}deg`);
      streak.style.setProperty(
        "--delay",
        `${index * -0.19 - (side > 0 ? 0.27 : 0)}s`,
      );
      streak.className = side < 0 ? "speed-left" : "speed-right";
      overlay.append(streak);
    }
  document.body.append(overlay);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const state = { opacity: 0 };
  return (speed, visible, dt): void => {
    const target = visible && !motion.matches ? speedLineIntensity(speed) : 0;
    state.opacity += (target - state.opacity) * (1 - Math.exp(-dt * 8));
    overlay.style.opacity = state.opacity.toFixed(3);
    overlay.classList.toggle("running", state.opacity > 0.004);
  };
};
