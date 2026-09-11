export const goalConfettiMarkup = (): string =>
  `<div class="goal-confetti" aria-hidden="true">${Array.from(
    { length: 30 },
    (_, index): string => {
      const kind =
        index % 3 === 0 ? "star" : index % 3 === 1 ? "bubble" : "ribbon";
      const side = index % 2 === 0 ? -1 : 1;
      const spread = side * (12 + ((index * 7) % 35));
      const rise = -(16 + ((index * 11) % 33));
      return `<i class="sea-confetti ${kind}" style="--drift:${spread}vw;--rise:${rise}vh;--delay:${(index % 6) * 45}ms;--spin:${side * (100 + index * 17)}deg;--size:${8 + (index % 4) * 3}px;--origin:${35 + (index % 5) * 7}%"></i>`;
    },
  ).join("")}</div>`;
