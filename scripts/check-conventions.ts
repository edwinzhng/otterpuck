const RAW_BUTTON_ALLOWED = new Set([
  "src/review.ts",
  "src/touch-markup.ts",
  "src/ui-components.ts",
]);
const DYNAMIC_BUTTON_ALLOWED = new Set([
  "src/multiplayer/ui.ts",
  "src/select-fields.ts",
]);

const violations: string[] = [];

for await (const path of new Bun.Glob("src/**/*.ts").scan(".")) {
  if (RAW_BUTTON_ALLOWED.has(path)) continue;
  const source = await Bun.file(path).text();
  for (const [index, line] of source.split("\n").entries()) {
    if (line.includes("<button")) {
      violations.push(
        `${path}:${index + 1} uses raw button markup. Use a helper from src/ui-components.ts.`,
      );
    }
    if (
      line.includes('document.createElement("button")') &&
      !DYNAMIC_BUTTON_ALLOWED.has(path)
    ) {
      violations.push(
        `${path}:${index + 1} creates a button directly. Add or use a shared UI helper.`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}
