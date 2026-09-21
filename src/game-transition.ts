export const createGameTransition = (): {
  cover: () => Promise<void>;
  reveal: () => void;
  cancel: () => void;
} => {
  const cover = document.createElement("dialog");
  cover.id = "game-transition";
  cover.setAttribute("aria-label", "Loading match");
  cover.addEventListener("cancel", (event) => event.preventDefault());
  document.body.append(cover);
  let animation: Animation | undefined;
  const cancel = (): void => {
    animation?.cancel();
    animation = undefined;
    cover.close();
  };
  return {
    cancel,
    cover: async (): Promise<void> => {
      cancel();
      // A top-layer dialog also covers an already-open multiplayer modal.
      cover.showModal();
      animation = cover.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 525,
        easing: "ease-in-out",
        fill: "forwards",
      });
      await animation.finished.catch(() => {});
    },
    reveal: (): void => {
      if (!cover.open) return;
      animation?.cancel();
      const fade = cover.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 675,
        easing: "ease-in-out",
        fill: "forwards",
      });
      animation = fade;
      void fade.finished
        .then(() => {
          if (animation === fade) cancel();
        })
        .catch(() => {});
    },
  };
};
