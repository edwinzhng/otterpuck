import { createAudio, type PoolAudio } from "./audio";
import { createAudioEventTracker } from "./audio-events";
import { createInput } from "./input";
import { createLearning } from "./learning";
import { matchResult } from "./match-result";
import { createFrameMeter } from "./performance";
import { renderPlayerLabels } from "./player-labels";
import { bindGraphicsSettings, bindVolumeSettings } from "./settings";
import {
  createSimulation,
  feedPracticePuck,
  resetPracticePuck,
  setPlayerHandedness,
  stepSimulation,
} from "./simulation";
import { freshControls, POOL, STEP } from "./types";
import { createUI, getElement, updateUI } from "./ui";
import { createSpeedLines } from "./view-effects";
import {
  createWorld,
  disposeWorld,
  loadSwimmers,
  renderWorld,
  resizeWorld,
  setWorldArena,
} from "./world";

const boot = async (): Promise<void> => {
  const ui = createUI();
  const world = createWorld(ui.canvas);
  const speedLines = createSpeedLines();
  const meter = createFrameMeter();
  const audioEvents = createAudioEventTracker();
  const vignette = getElement(".water-vignette", HTMLElement);
  const app: {
    phase: "menu" | "playing" | "paused" | "finished" | "learning";
    state: ReturnType<typeof createSimulation>;
    accumulator: number;
    previousTime: number;
    renderTime: number;
    uiTime: number;
    metricsTime: number;
    audio: PoolAudio | undefined;
  } = {
    phase: "menu",
    state: createSimulation(),
    accumulator: 0,
    previousTime: 0,
    renderTime: 0,
    uiTime: 0,
    metricsTime: 0,
    audio: undefined,
  };
  const pause = (): void => {
    if (app.phase !== "playing") return;
    app.phase = "paused";
    ui.pause.classList.remove("match-result");
    ui.pause.setAttribute("aria-label", "Paused");
    getElement("#restart", HTMLButtonElement).textContent = "Restart";
    app.audio?.setPlaying(false);
    input.setActive(false);
    const player = app.state.players.at(0);
    if (player) {
      player.charging = false;
      player.charge = 0;
    }
    ui.pause.classList.remove("hidden");
    getElement("#pause-title", HTMLElement).textContent = "Paused";
    getElement("#pause-description", HTMLElement).textContent = "";
    getElement("#resume", HTMLButtonElement).classList.remove("hidden");
    if (document.pointerLockElement) document.exitPointerLock();
  };
  const input = createInput(
    ui.canvas,
    pause,
    (): void => {
      ui.tactics = !ui.tactics;
      ui.hud.classList.toggle("tactics", ui.tactics);
    },
    (): void =>
      learning.active() ? learning.retry() : resetPracticePuck(app.state),
    (action): void => {
      if (app.state.mode !== "playground") return;
      if (action === "feed") feedPracticePuck(app.state);
      else if (action === "slow")
        app.state.playground.slowMotion = !app.state.playground.slowMotion;
      else
        app.state.playground.camera =
          app.state.playground.camera === "side" ? "first-person" : "side";
    },
  );
  bindGraphicsSettings(
    () => input.touch.enabled,
    (scale): void => {
      world.renderScale = scale;
      resizeWorld(world);
    },
  );
  const applyVolumes = bindVolumeSettings(() => app.audio);
  getElement("#pause-settings", HTMLButtonElement).addEventListener(
    "click",
    (): void => getElement("#settings-dialog", HTMLDialogElement).showModal(),
  );
  const enter = async (fresh: boolean): Promise<void> => {
    if (!world.loaded) return;
    ui.status.textContent = "";
    if (ui.sound) {
      if (!app.audio) app.audio = createAudio();
      app.audio.context.resume().catch(console.error);
      app.audio.setEnabled(true);
      app.audio.setMusicEnabled(ui.music);
      applyVolumes();
      app.audio.setPlaying(true);
    }
    if (!input.touch.enabled && ui.canvas.requestPointerLock)
      await Promise.resolve(ui.canvas.requestPointerLock()).catch((): void =>
        ui.canvas.focus(),
      );
    input.setActive(true);
    if (fresh) {
      app.state = createSimulation(
        ui.formation,
        ui.opposition,
        ui.mode,
        ui.duration,
        ui.handedness,
        {
          species: ui.species,
          position: ui.position,
          difficulty: ui.difficulty,
        },
      );
      input.clear();
      Object.assign(input.controls, freshControls());
      app.accumulator = 0;
      audioEvents.reset(app.state);
    }
    input.touch.update(app.state);
    app.phase = "playing";
    meter.reset();
    ui.menu.classList.add("hidden");
    ui.pause.classList.add("hidden");
    ui.hud.classList.remove("hidden");
    const playground = app.state.mode === "playground";
    ui.hud.classList.toggle("playground-hud", playground);
    ui.hud.classList.toggle("practice-hud", app.state.mode !== "match");
    getElement("#lab-readout", HTMLElement).classList.toggle("hidden", true);
    ui.elements.matchLabel.textContent =
      ui.mode !== "match" ? "FREE SWIM" : `${ui.formation} / ${ui.opposition}`;
  };
  const enterWithFeedback = (fresh: boolean): void => {
    enter(fresh).catch((error: Error): void => {
      const message = `Could not start the game: ${error.message}. Select Play or Resume to retry.`;
      ui.status.textContent = message;
      getElement("#pause-description", HTMLElement).textContent = message;
      console.error(error);
    });
  };
  ui.arena.addEventListener("change", (): void => {
    const id = ui.arena.value === "city" ? "city" : "tropical";
    const alreadyLoaded = world.loaded && world.arena?.id === id;
    world.loaded = false;
    ui.start.disabled = true;
    ui.status.textContent = "Loading pool…";
    (alreadyLoaded ? Promise.resolve(true) : setWorldArena(world, id))
      .then((selected): void => {
        if (!selected) return;
        world.loaded = true;
        ui.start.disabled = false;
        ui.status.textContent = "";
      })
      .catch((error: Error): void => {
        ui.status.textContent =
          "Pool could not load: " +
          error.message +
          ". Choose an arena to retry.";
      });
  });
  const learning = createLearning({
    state: () => app.state,
    touch: () => input.touch.enabled,
    suspend: (): void => {
      app.phase = "learning";
      input.setActive(false);
      app.audio?.setPlaying(false);
      if (document.pointerLockElement) document.exitPointerLock();
    },
    resume: (): void => enterWithFeedback(false),
    start: async (): Promise<void> => {
      ui.mode = "playground";
      await enter(true);
    },
    exit: (): void => getElement("#return-menu", HTMLButtonElement).click(),
  });
  getElement("#learn-button", HTMLButtonElement).addEventListener(
    "click",
    learning.open,
  );
  ui.start.addEventListener("click", (): void => enterWithFeedback(true));
  for (const id of ["handedness"])
    getElement(`#${id}`, HTMLSelectElement).addEventListener(
      "change",
      (): void => {
        input.clear();
        setPlayerHandedness(app.state, ui.handedness);
      },
    );
  getElement("#resume", HTMLButtonElement).addEventListener("click", (): void =>
    enterWithFeedback(false),
  );
  getElement("#restart", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      if (learning.active()) {
        learning.retry();
        enterWithFeedback(false);
      } else enterWithFeedback(true);
    },
  );
  getElement("#pause-button", HTMLButtonElement).addEventListener(
    "click",
    pause,
  );
  getElement("#return-menu", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      learning.stop();
      app.phase = "menu";
      input.setActive(false);
      input.clear();
      if (document.pointerLockElement) document.exitPointerLock();
      ui.pause.classList.add("hidden");
      ui.hud.classList.add("hidden");
      ui.menu.classList.remove("hidden");
      ui.menu.dispatchEvent(new Event("lobby-home"));
      app.audio?.setEnabled(false);
      app.audio?.setPlaying(false);
    },
  );
  getElement("#sound", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      ui.sound = !ui.sound;
      const button = getElement("#sound", HTMLButtonElement);
      button.textContent = ui.sound ? "Sound on" : "Sound off";
      button.setAttribute("aria-pressed", String(ui.sound));
      if (!app.audio) app.audio = createAudio();
      app.audio.setMusicEnabled(ui.music);
      applyVolumes();
      app.audio.setPlaying(app.phase === "playing");
      app.audio.context
        .resume()
        .then((): void => app.audio?.setEnabled(ui.sound))
        .catch(console.error);
    },
  );
  getElement("#music", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      ui.music = !ui.music;
      const button = getElement("#music", HTMLButtonElement);
      button.textContent = ui.music ? "Music on" : "Music off";
      button.setAttribute("aria-pressed", String(ui.music));
      app.audio?.setMusicEnabled(ui.music);
    },
  );
  const resize = (): void => resizeWorld(world);
  const viewportObserver = new ResizeObserver(resize);
  viewportObserver.observe(ui.canvas);
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", (): void => {
    resize();
    requestAnimationFrame(resize);
  });
  window.addEventListener("pagehide", (event: PageTransitionEvent): void => {
    if (event.persisted) {
      pause();
      return;
    }
    viewportObserver.disconnect();
    input.touch.dispose();
    disposeWorld(world);
    app.audio?.dispose();
  });
  ui.canvas.addEventListener("webglcontextlost", (event: Event): void => {
    event.preventDefault();
    pause();
    getElement("#pause-description", HTMLElement).textContent =
      "The graphics connection was interrupted. Reload this page to reconnect.";
  });
  const finish = (): void => {
    app.phase = "finished";
    ui.pause.classList.add("match-result");
    ui.pause.setAttribute("aria-label", "Match result");
    getElement("#restart", HTMLButtonElement).textContent = "Play again";
    app.audio?.setPlaying(false);
    input.setActive(false);
    if (document.pointerLockElement) document.exitPointerLock();
    ui.pause.classList.remove("hidden");
    const result = matchResult(
      app.state.scores,
      app.state.players.at(0)?.team ?? 0,
    );
    ui.pause.dataset.outcome = result.outcome;
    ui.pause.dataset.team =
      app.state.players.at(0)?.team === 1 ? "beavers" : "otters";
    getElement("#pause-title", HTMLElement).textContent = result.title;
    getElement("#pause-description", HTMLElement).textContent = result.score;
    getElement("#pause-description", HTMLElement).dataset.teams = result.teams;
    getElement("#resume", HTMLButtonElement).classList.add("hidden");
  };
  const frame = (now: number): void => {
    const frameStart = performance.now();
    requestAnimationFrame(frame);
    if (document.hidden) {
      app.previousTime = now;
      return;
    }
    const dt = Math.min((now - app.previousTime) / 1000, 0.1);
    app.previousTime = now;
    if (app.phase === "playing") {
      input.poll();
      app.accumulator +=
        dt *
        (app.state.mode === "playground" && app.state.playground.slowMotion
          ? 0.25
          : 1);
      const steps = Math.min(Math.floor(app.accumulator / STEP), 12);
      for (let step = 0; step < steps; step += 1) {
        if (app.phase !== "playing") break;
        const attemptedGrab = input.controls.knockdown;
        stepSimulation(app.state, input.controls, STEP);
        learning.tick(attemptedGrab);
      }
      app.accumulator -= steps * STEP;
      for (const cue of audioEvents.sample(app.state)) app.audio?.play(cue);
      if (app.state.finished) finish();
    }
    const renderDt = (now - app.renderTime) / 1000;
    const renderLimit =
      app.phase === "playing" ? 61 : app.phase === "menu" ? 31 : 16;
    if (renderDt + 0.0015 < 1 / renderLimit) return;
    app.renderTime = now;
    world.frameAverage += (renderDt - world.frameAverage) * 0.06;
    world.frameRate = 1 / world.frameAverage;
    renderWorld(
      world,
      app.state,
      now / 1000,
      renderDt,
      app.phase !== "menu",
      input.controls.pitch,
      app.phase === "playing" ? app.accumulator / STEP : 1,
      app.phase === "playing" && input.controls.vertical > 0,
    );
    meter.sample(renderDt * 1000, performance.now() - frameStart);
    if (now - app.metricsTime > 100) {
      ui.elements.fps.dataset.metrics = JSON.stringify(
        meter.read(world.renderer.info.render, world.renderer.info.memory),
      );
      app.metricsTime = now;
    }
    const human = app.state.players.at(0);
    speedLines(
      human ? Math.hypot(human.velocity.x, human.velocity.z) : 0,
      app.phase === "playing" &&
        !(
          app.state.mode === "playground" &&
          app.state.playground.camera === "side"
        ),
      renderDt,
    );
    vignette.style.opacity = world.camera.position.y > POOL.depth ? "0" : ".6";
    if (app.phase !== "menu")
      renderPlayerLabels(
        ui,
        app.state,
        world.camera,
        app.phase === "playing" ? app.accumulator / STEP : 1,
      );
    if (now - app.uiTime > 100 && app.phase !== "menu") {
      updateUI(ui, app.state, input, world);
      app.uiTime = now;
    }
  };
  requestAnimationFrame(frame);
  ui.arena.disabled = true;
  await setWorldArena(world, "tropical");
  await loadSwimmers(world);
  ui.arena.disabled = false;
  ui.start.disabled = false;
  ui.start.textContent = "Play";
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-mode]",
  ))
    button.disabled = false;
  ui.status.textContent = "";
  getElement("#learn-button", HTMLButtonElement).disabled = false;
  getElement("#boot-cover", HTMLElement).classList.add("ready");
  setTimeout((): void => getElement("#boot-cover", HTMLElement).remove(), 400);
  learning.offer();
};

const start = new URLSearchParams(window.location.search).has("review")
  ? import("./review").then(({ bootReview }): Promise<void> => bootReview())
  : boot();
start.catch((error: Error): void => {
  console.error(error);
  document.querySelector("#boot-cover")?.remove();
  const status = document.querySelector("#load-status");
  if (status)
    status.textContent = `The pool could not load: ${error.message}. Reload to try again.`;
});
