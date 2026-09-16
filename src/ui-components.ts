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
  `<div class="field select-field" data-select-field><label id="${id}-label" for="${id}">${label}</label><select id="${id}" hidden>${options.map(([value, text]): string => `<option value="${value}">${text}</option>`).join("")}</select><button id="${id}-trigger" class="select-field-trigger" type="button" aria-labelledby="${id}-label ${id}-value" aria-haspopup="listbox" aria-controls="${id}-options" aria-expanded="false"><span id="${id}-value">${options.at(0)?.at(1) ?? ""}</span><span class="select-field-chevron" aria-hidden="true"></span></button><div id="${id}-options" class="select-field-options" role="listbox" aria-labelledby="${id}-label" hidden>${options.map(([value, text], index): string => `<button type="button" class="select-field-option" role="option" data-select-option="${value}" aria-selected="${index === 0}">${text}</button>`).join("")}</div></div>`;

export const control = (key: string, label: string): string =>
  `<div class="control"><kbd>${key}</kbd><span>${label}</span></div>`;

export const dialog = (
  id: string,
  title: string,
  content: string,
  closeId: string,
): string =>
  `<dialog id="${id}" class="panel-dialog"><header><h2>${title}</h2>${button(closeId, "×", "icon", `aria-label="Close ${title.toLowerCase()}"`)}</header>${content}</dialog>`;
