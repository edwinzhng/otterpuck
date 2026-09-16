const focusOption = (
  options: readonly HTMLButtonElement[],
  index: number,
): void => options.at((index + options.length) % options.length)?.focus();

export const bindSelectFields = (): void => {
  for (const field of document.querySelectorAll<HTMLElement>(
    "[data-select-field]",
  )) {
    const select = field.querySelector<HTMLSelectElement>("select");
    const trigger = field.querySelector<HTMLButtonElement>("button");
    const list = field.querySelector<HTMLElement>("[role=listbox]");
    const value = field.querySelector<HTMLElement>("[id$=-value]");
    const options = Array.from(
      field.querySelectorAll<HTMLButtonElement>("[data-select-option]"),
    );
    if (!select || !trigger || !list || !value || options.length === 0)
      continue;

    const selectedIndex = (): number =>
      Math.max(
        0,
        options.findIndex(
          (option): boolean => option.dataset.selectOption === select.value,
        ),
      );
    const sync = (): void => {
      const index = selectedIndex();
      value.textContent = select.selectedOptions.item(0)?.textContent ?? "";
      for (const [optionIndex, option] of options.entries())
        option.setAttribute("aria-selected", String(optionIndex === index));
    };
    const close = (focusTrigger = false): void => {
      list.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if (focusTrigger) trigger.focus();
    };
    const open = (index = selectedIndex()): void => {
      list.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      focusOption(options, index);
    };
    const choose = (option: HTMLButtonElement): void => {
      select.value = option.dataset.selectOption ?? select.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      close(true);
    };

    sync();
    select.addEventListener("change", sync);
    select.addEventListener("input", sync);
    trigger.addEventListener("click", (): void => {
      if (list.hidden) open();
      else close();
    });
    trigger.addEventListener("keydown", (event): void => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        open(selectedIndex() + (event.key === "ArrowDown" ? 1 : -1));
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        open(event.key === "Home" ? 0 : options.length - 1);
      } else if (event.key === "Escape") close();
    });
    for (const [index, option] of options.entries()) {
      option.addEventListener("click", (): void => choose(option));
      option.addEventListener("keydown", (event): void => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          focusOption(options, index + (event.key === "ArrowDown" ? 1 : -1));
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          focusOption(options, event.key === "Home" ? 0 : options.length - 1);
        } else if (event.key === "Escape") close(true);
        else if (event.key === "Tab") close();
      });
    }
    document.addEventListener("pointerdown", (event): void => {
      if (event.target instanceof Node && !field.contains(event.target))
        close();
    });
  }
};
