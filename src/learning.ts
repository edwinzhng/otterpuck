import { assetUrl } from "./asset-url";
import { getElement } from "./dom";
import { withKeyLabels } from "./key-bindings";
import { lessons } from "./learning-content";
import {
  advanceProgress,
  beginProgress,
  type LessonId,
  lessonFeedback,
  lessonIds,
  savedLesson,
} from "./learning-progress";
import { prepareLesson } from "./learning-setup";
import type { Simulation } from "./types";
import { boundKeycap, button, keycap } from "./ui-components";

const prefix = "otterpuck-learn-v2";
const seenKey = `${prefix}-seen`;
const stepKey = `${prefix}-step`;
const completeKey = `${prefix}-complete`;
const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const save = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
const completed = (): boolean => read(completeKey) === "1";
const saveStep = (step: number): void => {
  if (!completed()) save(stepKey, String(step));
};
export const createLearning = (hooks: {
  state: () => Simulation;
  touch: () => boolean;
  suspend: () => void;
  resume: () => void;
  start: () => Promise<void>;
  exit: () => void;
}): {
  active: () => boolean;
  open: () => void;
  offer: () => void;
  tick: (attemptedGrab?: boolean, glance?: number) => void;
  stop: () => void;
  retry: () => void;
} => {
  const container = document.createElement("div");
  container.innerHTML = `<dialog id="lesson-card" class="lesson-card" aria-labelledby="lesson-title"><img id="lesson-image" width="1536" height="1024" alt="" hidden/><div class="lesson-copy"><span id="lesson-count"></span><h2 id="lesson-title"></h2><p id="lesson-text"></p><strong id="lesson-keys"></strong><div class="lesson-actions">${button("lesson-go", "Try it", "primary")}${button("lesson-close", "Not now")}</div></div></dialog><aside id="lesson-objective" class="lesson-objective" hidden aria-label="Practice objective"><div><span id="lesson-number"></span><strong id="lesson-task"></strong></div><progress id="lesson-progress" max="1" value="0" aria-label="Exercise progress"></progress><p id="lesson-feedback" role="status" aria-live="polite" hidden></p><div class="lesson-tools">${button("lesson-help", "Help")}${button("lesson-retry", "Retry")}${button("lesson-exit", "Exit")}</div><span class="lesson-shortcuts">${keycap("H")} Help · ${boundKeycap("retry")} Retry · ${keycap("Esc")} Pause</span></aside>`;
  document.body.append(container);
  const card = getElement("#lesson-card", HTMLDialogElement);
  const artwork = { version: 0 };
  const objective = getElement("#lesson-objective", HTMLElement);
  const feedback = getElement("#lesson-feedback", HTMLElement);
  const progress = getElement("#lesson-progress", HTMLProgressElement);
  const session = {
    active: false,
    index: 0,
    card: "intro",
    progress: beginProgress(hooks.state()),
  };
  const id = (): LessonId => lessonIds.at(session.index) ?? "swim";
  const lessonCopy = (value: string): string => {
    const rightHanded = hooks.state().players.at(0)?.handedness !== "left";
    const controls = hooks.touch()
      ? "[[Dummy]] + steer"
      : "[[{dummy}]] + [[{left}]] or [[{right}]]";
    return value
      .replaceAll("{curlDirection}", rightHanded ? "right" : "left")
      .replaceAll("{reverseDirection}", rightHanded ? "left" : "right")
      .replaceAll("{dummyControls}", controls);
  };
  const instructionMarkup = (value: string): string =>
    lessonCopy(value)
      .split(/(\[\[[^\]]+\]\])/)
      .map((part): string =>
        part.startsWith("[[") && part.endsWith("]]")
          ? keycap(withKeyLabels(part.slice(2, -2)))
          : part
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;"),
      )
      .join("");
  const stop = (): void => {
    session.active = false;
    objective.hidden = true;
    card.close();
    document.body.classList.remove("learning-active");
  };
  const exit = (): void => {
    stop();
    hooks.exit();
  };
  const display = (kind: string): void => {
    session.card = kind;
    hooks.suspend();
    objective.hidden = true;
    const lesson = lessons[id()];
    const source =
      kind === "intro" ? "dummy" : kind === "complete" ? "shot" : lesson.image;
    const version = ++artwork.version;
    const image = new Image(1536, 1024);
    image.id = "lesson-image";
    image.alt = kind === "lesson" ? lesson.title + " technique" : "";
    image.hidden = !source;
    image.style.visibility = "hidden";
    getElement("#lesson-image", HTMLImageElement).replaceWith(image);
    if (source) {
      image.src = assetUrl(`/art/learn/${source}-toon-v1.webp`);
      void image
        .decode()
        .then((): void => {
          if (version === artwork.version) image.style.visibility = "visible";
        })
        .catch((): void => {
          image.hidden = true;
        });
    }
    getElement("#lesson-count", HTMLElement).textContent =
      kind === "lesson"
        ? String(session.index + 1) + " / " + lessonIds.length
        : "";
    getElement("#lesson-title", HTMLElement).textContent =
      kind === "intro"
        ? "Learn how to play"
        : kind === "complete"
          ? "Ready to play"
          : lesson.title;
    getElement("#lesson-text", HTMLElement).innerHTML = instructionMarkup(
      kind === "intro"
        ? "Hone your skills."
        : kind === "complete"
          ? "Take your skills into the pool."
          : lesson.text,
    );
    getElement("#lesson-keys", HTMLElement).innerHTML =
      kind === "lesson"
        ? instructionMarkup(hooks.touch() ? lesson.touch : lesson.desktop)
        : "";
    getElement("#lesson-go", HTMLButtonElement).textContent =
      kind === "intro"
        ? !completed() && savedLesson(read(stepKey)) > 0
          ? "Continue"
          : "Start"
        : kind === "complete"
          ? "Free swim"
          : "Try it";
    getElement("#lesson-close", HTMLButtonElement).textContent =
      kind === "intro" ? "Not now" : "Menu";
    card.showModal();
  };
  const prepare = (): void => {
    const state = hooks.state();
    prepareLesson(state, id());
    session.progress = beginProgress(state);
    objective.classList.remove("lesson-success");
    feedback.hidden = true;
    feedback.textContent = "";
    getElement("#lesson-task", HTMLElement).textContent = lessons[id()].title;
  };
  const retry = (): void => {
    if (!session.active) return;
    prepare();
    progress.value = 0;
  };
  const advance = (): void => {
    session.index += 1;
    if (session.index >= lessonIds.length) {
      save(completeKey, "1");
      display("complete");
      return;
    }
    saveStep(session.index);
    prepare();
    display("lesson");
  };
  window.addEventListener("keydown", (event: KeyboardEvent): void => {
    if (session.active && !card.open && event.code === "KeyH")
      display("lesson");
  });
  const open = (): void => display("intro");
  getElement("#lesson-go", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      if (session.card === "intro") {
        save(seenKey, "1");
        session.index = completed() ? 0 : savedLesson(read(stepKey));
        getElement("#lesson-go", HTMLButtonElement).disabled = true;
        hooks
          .start()
          .then((): void => {
            session.active = true;
            document.body.classList.add("learning-active");
            prepare();
            display("lesson");
          })
          .catch((error: Error): void => {
            getElement("#lesson-text", HTMLElement).textContent = error.message;
          })
          .finally((): void => {
            getElement("#lesson-go", HTMLButtonElement).disabled = false;
          });
      } else if (session.card === "complete") {
        stop();
        hooks.resume();
      } else {
        card.close();
        objective.hidden = false;
        getElement("#lesson-number", HTMLElement).textContent =
          String(session.index + 1) + " / " + lessonIds.length;
        getElement("#lesson-task", HTMLElement).textContent =
          lessons[id()].title;
        progress.value = 0;
        hooks.resume();
      }
    },
  );
  getElement("#lesson-close", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      save(seenKey, "1");
      exit();
    },
  );
  card.addEventListener("cancel", (event): void => {
    event.preventDefault();
    save(seenKey, "1");
    exit();
  });
  getElement("#lesson-help", HTMLButtonElement).addEventListener(
    "click",
    (): void => display("lesson"),
  );
  getElement("#lesson-retry", HTMLButtonElement).addEventListener(
    "click",
    retry,
  );
  getElement("#lesson-exit", HTMLButtonElement).addEventListener("click", exit);
  return {
    active: (): boolean => session.active,
    open,
    offer: (): void => {
      if (read(seenKey) || completed()) return;
      save(seenKey, "1");
      open();
    },
    stop,
    retry,
    tick: (attemptedGrab = false, glance = 0): void => {
      if (!session.active || card.open) return;
      const amount = advanceProgress(
        id(),
        session.progress,
        hooks.state(),
        attemptedGrab,
        glance,
      );
      const result = lessonFeedback(
        session.progress,
        hooks.state().time,
        amount,
      );
      progress.value = result.success ? 1 : amount;
      objective.classList.toggle("lesson-success", result.success);
      const message = result.success
        ? "✓ Done"
        : result.hint
          ? lessonCopy(lessons[id()].hint) +
            (id() === "dummy"
              ? ""
              : " " +
                lessonCopy(
                  hooks.touch() ? lessons[id()].touch : lessons[id()].desktop,
                ))
          : "";
      const markup = instructionMarkup(message);
      if (feedback.innerHTML !== markup) feedback.innerHTML = markup;
      feedback.hidden = !message;
      if (result.advance) advance();
    },
  };
};
