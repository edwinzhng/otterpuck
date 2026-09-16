export const customPlayerName = (
  value: string | null | undefined,
): string | undefined => {
  const name = value?.trim();
  return name && !/^Player\s+\d+$/i.test(name) ? name : undefined;
};
