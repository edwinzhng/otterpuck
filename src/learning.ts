import { assetUrl } from "./asset-url";
import { getElement } from "./dom";
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
import { button } from "./ui-components";

const lessons: Record<
  LessonId,
  {
    title: string;
    text: string;
    desktop: string;
    hint: string;
    touch: string;
    image?: string;
  }
> = {
  swim: {
    title: "Swim",
    hint: "Keep swimming forward. Turn your body to steer.",
    text: "Swim a short distance. Turn your body to steer.",
    desktop: "W / A / S / D · Mouse to look",
    touch: "Left stick to swim · Drag right side to look",
  },
  grab: {
    title: "Grab the puck",
    hint: "Look down near your stick, then grab. Retry brings the puck back.",
    text: "Get close and look toward the puck. Grab it.",
    desktop: "X",
    touch: "Grab",
  },
  shot: {
    title: "Shoot",
    hint: "Bring the puck to your stick. Hold, then release to shoot.",
    text: "Hold to charge. Release to lift the puck.",
    desktop: "Hold left mouse · Release",
    touch: "Hold Shoot · Release",
    image: "shot",
  },
  curl: {
    title: "Curl",
    hint: "Keep it going for one full turn with the puck.",
    text: "Make one full turn with the puck inside your stick.",
    desktop: "Turn hard toward your stick hand",
    touch: "Hold Curl",
    image: "curl",
  },
  reverse: {
    title: "Reverse curl",
    hint: "Keep it going for one full turn the other way.",
    text: "Same hand. Make a full turn the other way.",
    desktop: "Turn hard away from your stick hand",
    touch: "Hold Reverse",
    image: "curl",
  },
  dummy: {
    title: "Dummy",
    hint: "Keep steering through the swerve until the sprint kicks in.",
    text: "Pull in, then swerve out to start a sprint burst.",
    desktop: "Hold right mouse + A or D",
    touch: "Hold Dummy + steer",
    image: "dummy",
  },
  rise: {
    title: "Get air",
    hint: "Keep rising until you reach the surface.",
    text: "Reach the surface to refill your air.",
    desktop: "Hold Space",
    touch: "Hold Rise",
  },
  dive: {
    title: "Dive",
    hint: "Keep descending until you reach the floor.",
    text: "Return to the floor to play the puck.",
    desktop: "Hold Ctrl",
    touch: "Hold Dive",
  },
};
const prefix = "otterpuck-learn-v1";
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
  tick: (attemptedGrab?: boolean) => void;
  stop: () => void;
  retry: () => void;
} => {
  const container = document.createElement("div");
  container.innerHTML = `<dialog id="lesson-card" class="lesson-card" aria-labelledby="lesson-title"><img id="lesson-image" width="1536" height="1024" alt="" hidden/><div class="lesson-copy"><span id="lesson-count"></span><h2 id="lesson-title"></h2><p id="lesson-text"></p><strong id="lesson-keys"></strong><div class="lesson-actions">${button("lesson-go", "Try it", "primary")}${button("lesson-close", "Not now")}</div></div></dialog><aside id="lesson-objective" class="lesson-objective" hidden aria-label="Practice objective"><div><span id="lesson-number"></span><strong id="lesson-task"></strong></div><progress id="lesson-progress" max="1" value="0" aria-label="Exercise progress"></progress><p id="lesson-feedback" role="status" aria-live="polite" hidden></p><div class="lesson-tools">${button("lesson-help", "Help")}${button("lesson-retry", "Retry")}${button("lesson-exit", "Exit")}</div><span class="lesson-shortcuts">H Help · P Retry · Esc Pause</span></aside>`;
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
        ? "Learn to play"
        : kind === "complete"
          ? "Ready to play"
          : lesson.title;
    getElement("#lesson-text", HTMLElement).textContent =
      kind === "intro"
        ? "Eight quick exercises. Go at your own pace."
        : kind === "complete"
          ? "Take your skills into the pool."
          : lesson.text;
    getElement("#lesson-keys", HTMLElement).textContent =
      kind === "lesson" ? (hooks.touch() ? lesson.touch : lesson.desktop) : "";
    getElement("#lesson-go", HTMLButtonElement).textContent =
      kind === "intro"
        ? savedLesson(read(prefix + "-step")) > 0
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
  window.addEventListener("keydown", (event: KeyboardEvent): void => {
    if (session.active && !card.open && event.code === "KeyH")
      display("lesson");
  });
  const open = (): void => display("intro");
  getElement("#lesson-go", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      if (session.card === "intro") {
        save(prefix + "-seen", "1");
        session.index = savedLesson(read(prefix + "-step"));
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
      save(prefix + "-seen", "1");
      exit();
    },
  );
  card.addEventListener("cancel", (event): void => {
    event.preventDefault();
    save(prefix + "-seen", "1");
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
      if (!read(prefix + "-seen")) open();
    },
    stop,
    retry,
    tick: (attemptedGrab = false): void => {
      if (!session.active || card.open) return;
      const amount = advanceProgress(
        id(),
        session.progress,
        hooks.state(),
        attemptedGrab,
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
          ? lessons[id()].hint +
            " " +
            (hooks.touch() ? lessons[id()].touch : lessons[id()].desktop)
          : "";
      if (feedback.textContent !== message) feedback.textContent = message;
      feedback.hidden = !message;
      if (!result.advance) return;
      session.index += 1;
      if (session.index >= lessonIds.length) {
        save(prefix + "-complete", "1");
        save(prefix + "-step", "0");
        display("complete");
      } else {
        save(prefix + "-step", String(session.index));
        prepare();
        display("lesson");
      }
    },
  };
};
