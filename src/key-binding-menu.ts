import {
  DESKTOP_CONTROL_HELP,
  KEY_BINDING_ACTIONS,
  type KeyBindingAction,
} from "./control-registry";
import { getElement, setText } from "./dom";
import {
  assignKey,
  bindingAction,
  bindingLabel,
  currentKeyBindings,
  DEFAULT_KEY_BINDINGS,
  keyCode,
  keyLabel,
  loadKeyboardLayout,
  mouseCode,
  onKeyBindingsChange,
  RESERVED_CODES,
  saveKeyBindings,
  withKeyLabels,
} from "./key-bindings";
import { boundKeycap, button, control } from "./ui-components";

const ACTIONS = Object.keys(KEY_BINDING_ACTIONS) as KeyBindingAction[];
const actionName = (action: KeyBindingAction): string =>
  KEY_BINDING_ACTIONS[action].label;
const actionHint = (action: KeyBindingAction): string => {
  const entry = KEY_BINDING_ACTIONS[action];
  return "hint" in entry ? ` title="${entry.hint}"` : "";
};
const isAction = (value: string | undefined): value is KeyBindingAction =>
  value !== undefined && value in KEY_BINDING_ACTIONS;

export const keyboardHelpMarkup = (): string =>
  DESKTOP_CONTROL_HELP.map(([keys, label]): string =>
    control(withKeyLabels(keys), label),
  ).join("");

export const keyBindingsMarkup = (): string =>
  `<p class="key-bindings-intro">Choose an action. Then press a key or mouse button.</p><div class="key-bindings">${ACTIONS.map(
    (action): string =>
      `<div class="key-binding"${actionHint(action)}><span id="key-${action}-label">${actionName(action)}</span>${button(`key-${action}`, boundKeycap(action), "secondary", `data-key-action="${action}" aria-pressed="false" aria-labelledby="key-${action}-label key-${action}"`)}</div>`,
  ).join(
    "",
  )}</div><p id="key-bindings-status" class="key-bindings-status" role="status"></p><div class="settings-footer">${button("reset-keys", "Reset keys", "quiet")}</div>`;

const renderKeyLabels = (): void => {
  for (const key of document.querySelectorAll<HTMLElement>("[data-binding]")) {
    const action = key.dataset.binding;
    if (isAction(action)) setText(key, bindingLabel(action));
  }
  const help = keyboardHelpMarkup();
  for (const grid of document.querySelectorAll<HTMLElement>(".keyboard-help"))
    grid.innerHTML = help;
};

export const bindKeyBindingMenu = (): void => {
  const dialog = getElement("#keys-dialog", HTMLDialogElement);
  const status = getElement("#key-bindings-status", HTMLElement);
  const capture: {
    action?: KeyBindingAction;
    button?: HTMLButtonElement;
    ignoreClick: boolean;
  } = { ignoreClick: false };
  const stop = (message = ""): void => {
    if (capture.button && capture.action) {
      capture.button.innerHTML = boundKeycap(capture.action);
      capture.button.setAttribute("aria-pressed", "false");
    }
    capture.action = undefined;
    capture.button = undefined;
    status.textContent = message;
  };
  const choose = (code: string): void => {
    const action = capture.action;
    if (!action) return;
    if (RESERVED_CODES.has(code)) {
      stop();
      return;
    }
    const before = currentKeyBindings();
    const owner = bindingAction(before, code);
    saveKeyBindings(assignKey(before, action, code));
    stop(
      owner && owner !== action
        ? `${actionName(owner)} now uses ${keyLabel(before[action])}.`
        : "",
    );
  };
  dialog.addEventListener("click", (event: MouseEvent): void => {
    if (!(event.target instanceof Element) || capture.action) return;
    const target = event.target.closest<HTMLButtonElement>("[data-key-action]");
    const action = target?.dataset.keyAction;
    if (!target || !isAction(action)) return;
    capture.action = action;
    capture.button = target;
    target.textContent = "Press a key";
    target.setAttribute("aria-pressed", "true");
    status.textContent = `Press a key or mouse button for ${actionName(action)}. Press Esc to cancel.`;
  });
  window.addEventListener(
    "keydown",
    (event: KeyboardEvent): void => {
      if (!capture.action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === "Escape") stop();
      else choose(keyCode(event.code));
    },
    { capture: true },
  );
  window.addEventListener(
    "mousedown",
    (event: MouseEvent): void => {
      capture.ignoreClick = false;
      if (!capture.action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      capture.ignoreClick = event.button === 0;
      choose(mouseCode(event.button));
    },
    { capture: true },
  );
  // The click after a captured mouse button must not start a new capture or
  // close the dialog from the backdrop.
  window.addEventListener(
    "click",
    (event: MouseEvent): void => {
      if (!capture.ignoreClick) return;
      capture.ignoreClick = false;
      event.stopImmediatePropagation();
    },
    { capture: true },
  );
  window.addEventListener(
    "auxclick",
    (event: MouseEvent): void => {
      if (dialog.open) event.preventDefault();
    },
    { capture: true },
  );
  dialog.addEventListener("contextmenu", (event: MouseEvent): void =>
    event.preventDefault(),
  );
  dialog.addEventListener("close", (): void => stop());
  getElement("#reset-keys", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      saveKeyBindings({ ...DEFAULT_KEY_BINDINGS });
      stop("Keys reset.");
    },
  );
  onKeyBindingsChange(renderKeyLabels);
  void loadKeyboardLayout().then(renderKeyLabels);
};
