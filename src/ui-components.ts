export const button = (
  id: string,
  label: string,
  kind = "secondary",
  attributes = "",
): string =>
  `<button id="${id}" class="button button-${kind}" type="button" ${attributes}>${label}</button>`;

export const field = (
  id: string,
  label: string,
  options: readonly (readonly [string, string])[],
): string =>
  `<label class="field" for="${id}"><span>${label}</span><select id="${id}">${options.map(([value, text]): string => `<option value="${value}">${text}</option>`).join("")}</select></label>`;

export const control = (key: string, label: string): string =>
  `<div class="control"><kbd>${key}</kbd><span>${label}</span></div>`;

export const dialog = (
  id: string,
  title: string,
  content: string,
  closeId: string,
): string =>
  `<dialog id="${id}" class="panel-dialog"><header><h2>${title}</h2>${button(closeId, "×", "icon", `aria-label="Close ${title.toLowerCase()}"`)}</header>${content}</dialog>`;
