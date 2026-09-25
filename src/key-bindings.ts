import { z } from "zod";
import { KEY_BINDING_ACTIONS, type KeyBindingAction } from "./control-registry";

export type KeyBindings = Record<KeyBindingAction, string>;

const STORAGE_KEY = "otterpuck-key-bindings";
const ACTIONS = Object.keys(KEY_BINDING_ACTIONS) as KeyBindingAction[];
// Escape always pauses and releases the mouse, so no action can take it.
export const RESERVED_CODES = new Set(["Escape"]);

export const DEFAULT_KEY_BINDINGS = Object.fromEntries(
  ACTIONS.map((action): [KeyBindingAction, string] => [
    action,
    KEY_BINDING_ACTIONS[action].code,
  ]),
) as KeyBindings;

export const keyCode = (code: string): string =>
  code.replace(/^(Shift|Control|Alt|Meta)(Left|Right)$/, "$1");

export const mouseCode = (button: number): string => `Mouse${button}`;

export const bindingAction = (
  bindings: KeyBindings,
  code: string,
): KeyBindingAction | undefined =>
  ACTIONS.find((action): boolean => bindings[action] === code);

// A key belongs to one action. Taking a key from another action gives that
// action the old key, so no action is left without a key.
export const assignKey = (
  bindings: KeyBindings,
  action: KeyBindingAction,
  code: string,
): KeyBindings => {
  const owner = bindingAction(bindings, code);
  return {
    ...bindings,
    ...(owner && owner !== action ? { [owner]: bindings[action] } : {}),
    [action]: code,
  };
};

const storedBindings = z.record(z.string(), z.string().min(1).max(40));

export const parseKeyBindings = (value: unknown): KeyBindings => {
  const stored = storedBindings.safeParse(value);
  if (!stored.success) return { ...DEFAULT_KEY_BINDINGS };
  return ACTIONS.reduce((bindings, action): KeyBindings => {
    const code = stored.data[action];
    return code === undefined || RESERVED_CODES.has(code)
      ? bindings
      : assignKey(bindings, action, code);
  }, DEFAULT_KEY_BINDINGS);
};

const MOUSE_LABELS = [
  "Left mouse",
  "Middle mouse",
  "Right mouse",
  "Mouse 4",
  "Mouse 5",
];
const KEY_LABELS: Record<string, string> = {
  Control: "Ctrl",
  Meta: "Meta",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  IntlBackslash: "<",
};

type LayoutMap = { get: (code: string) => string | undefined };
const layout: { map?: LayoutMap } = {};

// Codes name physical keys. The layout map gives the character printed on the
// key in the player's layout, for example Z for KeyY on a German keyboard.
export const loadKeyboardLayout = async (): Promise<void> => {
  const keyboard = (
    navigator as Navigator & {
      keyboard?: { getLayoutMap?: () => Promise<LayoutMap> };
    }
  ).keyboard;
  layout.map = await keyboard?.getLayoutMap?.().catch(() => undefined);
};

export const keyLabel = (code: string): string => {
  if (code.startsWith("Mouse"))
    return MOUSE_LABELS.at(Number(code.slice(5))) ?? code;
  const printed = layout.map?.get(code);
  if (printed && printed.trim() !== "") return printed.toUpperCase();
  return (
    KEY_LABELS[code] ??
    code
      .replace(/^Key/, "")
      .replace(/^Digit/, "")
      .replace(/^Numpad/, "Num ")
  );
};

const listeners = new Set<(bindings: KeyBindings) => void>();
const store: { bindings?: KeyBindings } = {};

const readStored = (): KeyBindings => {
  try {
    return parseKeyBindings(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"),
    );
  } catch {
    return { ...DEFAULT_KEY_BINDINGS };
  }
};

export const currentKeyBindings = (): KeyBindings => {
  store.bindings ??= readStored();
  return store.bindings;
};

export const saveKeyBindings = (bindings: KeyBindings): void => {
  store.bindings = bindings;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {}
  for (const listener of listeners) listener(bindings);
};

export const onKeyBindingsChange = (
  listener: (bindings: KeyBindings) => void,
): void => {
  listeners.add(listener);
};

export const bindingLabel = (action: KeyBindingAction): string =>
  keyLabel(currentKeyBindings()[action]);

// Replace each {action} token with the label of the bound key.
export const withKeyLabels = (template: string): string =>
  template.replace(/\{(\w+)\}/g, (token, name: string): string =>
    name in KEY_BINDING_ACTIONS
      ? bindingLabel(name as KeyBindingAction)
      : token,
  );
