// Hold one frame of the outgoing map instead of rendering two arenas each frame.
export const createBackgroundTransition = (
  canvas: HTMLCanvasElement,
): {
  capture: (render: () => void) => void;
  reveal: () => void;
} => {
  let overlay: HTMLCanvasElement | undefined;
  return {
    capture: (render): void => {
      overlay?.remove();
      overlay = undefined;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const frame = document.createElement("canvas");
      frame.width = canvas.width;
      frame.height = canvas.height;
      frame.className = "background-crossfade";
      frame.setAttribute("aria-hidden", "true");
      const context = frame.getContext("2d");
      if (!context) return;
      render();
      context.drawImage(canvas, 0, 0);
      canvas.after(frame);
      overlay = frame;
    },
    reveal: (): void => {
      const frame = overlay;
      overlay = undefined;
      if (!frame) return;
      requestAnimationFrame((): void => {
        const fade = frame.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 900,
          easing: "ease-in-out",
          fill: "forwards",
        });
        void fade.finished
          .finally((): void => frame.remove())
          .catch((): void => {});
      });
    },
  };
};
