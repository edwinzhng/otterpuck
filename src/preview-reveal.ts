export const revealPreview = (
  image: HTMLImageElement,
  source: string,
): void => {
  if (image.getAttribute("src") === source) return;
  image.hidden = true;
  image.src = source;
  void image
    .decode()
    .then((): void => {
      if (image.getAttribute("src") !== source) return;
      image.hidden = false;
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        image.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 350,
          easing: "ease-out",
        });
    })
    .catch((): void => {
      if (image.getAttribute("src") === source) image.removeAttribute("src");
    });
};
