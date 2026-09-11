export const bindFullscreen = (
  button: HTMLButtonElement,
  pause: () => void,
  signal: AbortSignal,
): void => {
  const help = document.createElement("dialog");
  help.className = "fullscreen-help";
  help.innerHTML =
    '<h2>Play full screen</h2><p>On iPhone, open Share → Add to Home Screen, then launch Otterpuck from its icon.</p><form method="dialog"><button>Got it</button></form>';
  document.body.append(help);
  const fallback = (): void => {
    pause();
    help.showModal();
  };
  const toggle = (): void => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(fallback);
      return;
    }
    if (document.fullscreenEnabled) {
      void document.documentElement.requestFullscreen().catch(fallback);
      return;
    }
    fallback();
  };
  button.addEventListener("click", toggle, { signal });
  window.addEventListener(
    "keydown",
    (event: KeyboardEvent): void => {
      if (
        event.code !== "KeyF" ||
        !event.ctrlKey ||
        event.altKey ||
        event.metaKey
      )
        return;
      event.preventDefault();
      if (!event.repeat) toggle();
    },
    { signal },
  );
  const update = (): void => {
    const active = Boolean(document.fullscreenElement);
    button.setAttribute(
      "aria-label",
      active ? "Exit fullscreen" : "Enter fullscreen",
    );
    button.setAttribute("aria-pressed", String(active));
    button.hidden = matchMedia("(display-mode: standalone)").matches;
  };
  document.addEventListener("fullscreenchange", update, { signal });
  signal.addEventListener("abort", (): void => help.remove(), { once: true });
  update();
};
