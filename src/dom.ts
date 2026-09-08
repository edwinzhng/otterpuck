export const getElement = <T extends Element>(
  selector: string,
  elementType: { new (...args: never[]): T },
): T => {
  const element = document.querySelector(selector);
  if (!(element instanceof elementType))
    throw new Error(`Missing element: ${selector}`);
  return element;
};
