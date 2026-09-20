export const SWIM_TURNS = [1.5, 2, 3] as const;
export type SwimTurn = (typeof SWIM_TURNS)[number];
export const DEFAULT_SWIM_TURN: SwimTurn = 3;
const STORAGE_KEY = "otterpuck-swim-turn";

export const swimTurnChoice = (value: string | null): SwimTurn | undefined =>
  SWIM_TURNS.find((turn): boolean => String(turn) === value);

export const savedSwimTurn = (): SwimTurn => {
  try {
    return (
      swimTurnChoice(localStorage.getItem(STORAGE_KEY)) ?? DEFAULT_SWIM_TURN
    );
  } catch {
    return DEFAULT_SWIM_TURN;
  }
};

export const saveSwimTurn = (turn: SwimTurn): void => {
  try {
    localStorage.setItem(STORAGE_KEY, String(turn));
  } catch {}
};
