const fieldOptions = (list: HTMLElement): readonly HTMLButtonElement[] =>
  Array.from(list.querySelectorAll<HTMLButtonElement>("[data-select-option]"));

const focusOption = (
  options: readonly HTMLButtonElement[],
  index: number,
): void => options.at((index + options.length) % options.length)?.focus();

const renderOptions = (select: HTMLSelectElement, list: HTMLElement): void => {
  list.replaceChildren(
    ...Array.from(select.options, (option): HTMLButtonElement => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "select-field-option";
      button.role = "option";
      button.dataset.selectOption = option.value;
      button.textContent = option.textContent;
      return button;
    }),
  );
};

/** Redraw a select field's listbox after its `<option>` list changed. */
export const refreshSelectField = (select: HTMLSelectElement): void => {
  select.dispatchEvent(new Event("select-field-refresh"));
};

export const bindSelectFields = (): void => {
  for (const field of document.querySelectorAll<HTMLElement>(
    "[data-select-field]",
  )) {
    const select = field.querySelector<HTMLSelectElement>("select");
    const trigger = field.querySelector<HTMLButtonElement>("button");
    const list = field.querySelector<HTMLElement>("[role=listbox]");
    const value = field.querySelector<HTMLElement>("[id$=-value]");
    if (!select || !trigger || !list || !value) continue;

    const selectedIndex = (): number =>
      Math.max(
        0,
        fieldOptions(list).findIndex(
          (option): boolean => option.dataset.selectOption === select.value,
        ),
      );
    const sync = (): void => {
      const index = selectedIndex();
      value.textContent = select.selectedOptions.item(0)?.textContent ?? "";
      for (const [optionIndex, option] of fieldOptions(list).entries())
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
      focusOption(fieldOptions(list), index);
    };
    const choose = (option: HTMLButtonElement): void => {
      select.value = option.dataset.selectOption ?? select.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      close(true);
    };

    renderOptions(select, list);
    sync();
    select.addEventListener("change", sync);
    select.addEventListener("input", sync);
    select.addEventListener("select-field-refresh", (): void => {
      close();
      renderOptions(select, list);
      sync();
    });
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
        open(event.key === "Home" ? 0 : fieldOptions(list).length - 1);
      } else if (event.key === "Escape") close();
    });
    list.addEventListener("click", (event): void => {
      const option =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>("[data-select-option]")
          : undefined;
      if (option) choose(option);
    });
    list.addEventListener("keydown", (event): void => {
      const options = fieldOptions(list);
      const index = options.findIndex((option): boolean =>
        option.contains(event.target instanceof Node ? event.target : null),
      );
      if (index < 0) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        focusOption(options, index + (event.key === "ArrowDown" ? 1 : -1));
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        focusOption(options, event.key === "Home" ? 0 : options.length - 1);
      } else if (event.key === "Escape") close(true);
      else if (event.key === "Tab") close();
    });
    document.addEventListener("pointerdown", (event): void => {
      if (event.target instanceof Node && !field.contains(event.target))
        close();
    });
  }
};
