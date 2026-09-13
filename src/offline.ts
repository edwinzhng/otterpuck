declare const OFFLINE_ENABLED: boolean;

export const enableOffline = (): void => {
  if (
    typeof OFFLINE_ENABLED === "undefined" ||
    !OFFLINE_ENABLED ||
    !window.isSecureContext ||
    !("serviceWorker" in navigator)
  )
    return;
  const register = (): void => {
    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch((): void => {});
  };
  register();
  window.addEventListener("online", register);
};
