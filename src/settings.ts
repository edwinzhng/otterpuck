import type { PoolAudio } from "./audio";
import { getElement } from "./dom";

export const bindGraphicsSettings = (
  touch: () => boolean,
  applyScale: (scale: number) => void,
): void => {
  const quality = getElement("#quality", HTMLSelectElement);
  const graphics = { chosen: localStorage.getItem("otterpuck-quality") };
  const applyQuality = (): void => {
    quality.value =
      ["0.85", "1", "1.35", "1.7", "2"].find(
        (value): boolean => value === graphics.chosen,
      ) ?? (touch() ? "1.7" : "1.35");
    quality.dispatchEvent(new Event("input", { bubbles: true }));
    applyScale(Number(quality.value));
  };
  applyQuality();
  window.addEventListener("input-mode-change", applyQuality);
  quality.addEventListener("change", (event: Event): void => {
    if (!(event.target instanceof HTMLSelectElement)) return;
    graphics.chosen = event.target.value;
    localStorage.setItem("otterpuck-quality", graphics.chosen);
    applyQuality();
  });
};

export const bindVolumeSettings = (
  audio: () => PoolAudio | undefined,
): (() => void) => {
  const volumes = { music: 0.5, effects: 1 };
  const applyVolumes = (): void => {
    for (const kind of ["music", "effects"] as const)
      audio()?.setVolume(kind, volumes[kind]);
  };
  for (const kind of ["music", "effects"] as const) {
    const saved = localStorage.getItem(`otterpuck-volume-${kind}`);
    const parsed = saved === null ? volumes[kind] : Number(saved);
    volumes[kind] = Number.isFinite(parsed)
      ? Math.max(0, Math.min(1, parsed))
      : volumes[kind];
    const slider = getElement(`#${kind}-volume`, HTMLInputElement);
    const output = getElement(`#${kind}-volume-value`, HTMLOutputElement);
    slider.value = String(Math.round(volumes[kind] * 100));
    output.value = `${slider.value}%`;
    slider.addEventListener("input", (): void => {
      volumes[kind] = Number(slider.value) / 100;
      output.value = `${slider.value}%`;
      localStorage.setItem(`otterpuck-volume-${kind}`, String(volumes[kind]));
      applyVolumes();
    });
  }
  return applyVolumes;
};
