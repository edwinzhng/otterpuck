declare const OFFLINE_ENABLED: boolean;

export const enableOffline = (): void => {
  if (
    typeof OFFLINE_ENABLED === "undefined" ||
    !OFFLINE_ENABLED ||
    !window.isSecureContext ||
    !("serviceWorker" in navigator)
  )
    return;
  const controlled = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", (): void => {
    if (!controlled || reloading) return;
    reloading = true;
    location.reload();
  });
  const register = (): void => {
    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then(async (registration): Promise<void> => {
        await registration.update();
      })
      .catch((): void => {});
  };
  register();
  window.addEventListener("online", register);
};
