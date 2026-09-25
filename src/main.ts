import { inject } from "@vercel/analytics";
import { ARENA_IDS, isArenaId } from "./arena-catalog";
import { createAudio, type PoolAudio } from "./audio";
import { createAudioEventTracker } from "./audio-events";
import { createBackgroundTransition } from "./background-transition";
import { loadCharacter } from "./character-assets";
import { randomOpponent } from "./characters";
import { createGameTransition } from "./game-transition";
import { createInput } from "./input";
import { createLearning } from "./learning";
import { updateLook } from "./look-controls";
import { matchResult } from "./match-result";
import { createHudPresentation } from "./multiplayer/hud";
import { createRoomSimulation } from "./multiplayer/match";
import { bindMultiplayer } from "./multiplayer/ui";
import { enableOffline } from "./offline";
import { createFrameMeter } from "./performance";
import { bindPlayerBuild } from "./player-build";
import { renderPlayerLabels } from "./player-labels";
import { NO_NAMES } from "./player-names";
import { sizeLabel, teamSize } from "./positions";
import {
  bindAutoCurlSetting,
  bindGraphicsSettings,
  bindVolumeSettings,
} from "./settings";
import {
  createSimulation,
  feedPracticePuck,
  resetPracticePuck,
  setPlayerHandedness,
  stepSimulation,
} from "./simulation";
import { createTackleTracker } from "./tackle-events";
import { createTurnoverBanner } from "./turnover-banner";
import { freshControls, type Player, POOL, STEP } from "./types";
import { createUI, getElement, updateHudValues, updateUI } from "./ui";
import { createSpeedLines } from "./view-effects";
import {
  createWorld,
  disposeWorld,
  loadSwimmers,
  prepareSwimmers,
  renderWorld,
  resizeWorld,
  setWorldArena,
} from "./world";

const boot = async (): Promise<void> => {
  inject();
  const ui = createUI();
  const gameTransition = createGameTransition();
  let revealGame = false;
  const world = createWorld(ui.canvas);
  const speedLines = createSpeedLines();
  const meter = createFrameMeter();
  const multiplayerHud = createHudPresentation();
  const audioEvents = createAudioEventTracker();
  const tackleEvents = createTackleTracker();
  const turnoverBanner = createTurnoverBanner();
  let multiplayer: ReturnType<typeof bindMultiplayer> | undefined;
  let swimmersLoading: Promise<void> | undefined;
  const vignette = getElement(".water-vignette", HTMLElement);
  const app: {
    phase: "menu" | "playing" | "paused" | "finished" | "learning";
    state: ReturnType<typeof createSimulation>;
    accumulator: number;
    previousTime: number;
    renderTime: number;
    uiTime: number;
    metricsTime: number;
    tackleRevision: number;
    audio: PoolAudio | undefined;
  } = {
    phase: "menu",
    state: createSimulation(),
    accumulator: 0,
    previousTime: 0,
    renderTime: 0,
    uiTime: 0,
    metricsTime: 0,
    tackleRevision: -1,
    audio: undefined,
  };
  const pause = (): void => {
    if (app.phase !== "playing") return;
    app.phase = "paused";
    multiplayer?.cancelInput();
    ui.pause.classList.remove("match-result");
    ui.pause.setAttribute("aria-label", "Paused");
    getElement("#restart", HTMLButtonElement).textContent =
      multiplayer?.active() ? "Leave match" : "Restart";
    app.audio?.setPlaying(false);
    input.setActive(false);
    const player = app.state.players.at(0);
    if (player) {
      player.charging = false;
      player.charge = 0;
    }
    ui.pause.classList.remove("hidden");
    getElement("#pause-title", HTMLElement).textContent = "Paused";
    getElement("#pause-description", HTMLElement).textContent =
      multiplayer?.active()
        ? "The match continues while this menu is open."
        : "";
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
      if (action === "log") {
        ui.hud.classList.toggle("show-tackles");
        return;
      }
      if (app.state.mode !== "playground") return;
      if (action === "feed") feedPracticePuck(app.state);
      else if (action === "slow")
        app.state.playground.slowMotion = !app.state.playground.slowMotion;
      else
        app.state.playground.camera =
          app.state.playground.camera === "side" ? "first-person" : "side";
    },
  );
  const requestMouseCapture = async (): Promise<void> => {
    if (input.touch.enabled || !ui.canvas.requestPointerLock) return;
    await Promise.resolve(ui.canvas.requestPointerLock()).catch((): void =>
      ui.canvas.focus(),
    );
  };
  ui.canvas.addEventListener("mousedown", (): void => {
    if (app.phase === "playing" && !document.pointerLockElement)
      void requestMouseCapture();
  });
  bindGraphicsSettings(
    () => input.touch.enabled,
    (scale): void => {
      world.renderScale = scale;
      resizeWorld(world);
    },
  );
  const applyVolumes = bindVolumeSettings(() => app.audio);
  const prepareAudio = (): PoolAudio => {
    app.audio ??= createAudio();
    app.audio.setMusicEnabled(ui.music);
    applyVolumes();
    app.audio.setEnabled(ui.sound);
    return app.audio;
  };
  prepareAudio();
  const startMenuMusic = (): void => {
    if (app.phase !== "menu" || !ui.sound) return;
    const audio = prepareAudio();
    audio.setMenu();
    audio.context.resume().catch(console.error);
  };
  document.addEventListener("pointerdown", startMenuMusic, { once: true });
  document.addEventListener("keydown", startMenuMusic, { once: true });
  const menuSoundControl = (
    target: EventTarget | null,
  ): Element | undefined => {
    if (!(target instanceof Element)) return;
    const control = target.closest("button, [role='option'], .toggle-setting");
    if (
      !control ||
      control.matches(":disabled, .touch-button, .select-field-trigger") ||
      control.closest("[hidden]")
    )
      return;
    return control;
  };
  document.addEventListener(
    "click",
    (event: MouseEvent): void => {
      const control = menuSoundControl(event.target);
      if (!control) return;
      app.audio?.click();
    },
    { capture: true },
  );
  getElement("#pause-settings", HTMLButtonElement).addEventListener(
    "click",
    (): void => getElement("#settings-dialog", HTMLDialogElement).showModal(),
  );
  const enter = async (
    fresh: boolean,
    coverStart = fresh && ui.mode === "match",
  ): Promise<void> => {
    if (!world.loaded) {
      ui.status.textContent = "Loading players…";
      ui.start.disabled = true;
      swimmersLoading ??= loadSwimmers(world).catch((error: unknown) => {
        swimmersLoading = undefined;
        throw error;
      });
      await swimmersLoading;
      ui.start.disabled = false;
    }
    world.arenaRequest++;
    const arena = multiplayer?.active()
      ? multiplayer.arena()
      : isArenaId(ui.arena.value)
        ? ui.arena.value
        : "tropical";
    if (world.arena?.id !== arena && !(await setWorldArena(world, arena)))
      return;
    ui.status.textContent = "";
    if (ui.sound) {
      const audio = prepareAudio();
      audio.context.resume().catch(console.error);
      audio.setPlaying(true);
    }
    if (fresh) {
      multiplayer?.leave();
      app.state = createSimulation(
        ui.formation,
        ui.opposition,
        ui.mode,
        ui.duration,
        ui.handedness,
        {
          species: ui.species,
          team: ui.team,
          position: ui.position,
          difficulty: ui.difficulty,
          swimTurn: ui.swimTurn,
          attributes: ui.attributes,
          autoCurl: ui.autoCurl,
        },
      );
      input.clear();
      Object.assign(input.controls, freshControls());
      if (ui.mode === "match") {
        const opponent = randomOpponent(ui.species);
        for (const player of app.state.players)
          if (player.team !== ui.team) player.species = opponent;
      }
      app.accumulator = 0;
      audioEvents.reset(app.state);
      tackleEvents.reset(app.state);
    }
    await prepareSwimmers(world, app.state.players);
    if (coverStart) await gameTransition.cover();
    await requestMouseCapture();
    input.setActive(true);
    input.touch.update(app.state);
    app.phase = "playing";
    revealGame = true;
    if (!app.state.faceoff) app.audio?.startGameplayMusic();
    meter.reset();
    ui.menu.classList.add("hidden");
    ui.pause.classList.add("hidden");
    ui.hud.classList.remove("hidden");
    const playground = app.state.mode === "playground";
    ui.hud.classList.toggle("playground-hud", playground);
    ui.hud.classList.toggle("practice-hud", app.state.mode !== "match");
    getElement("#lab-readout", HTMLElement).classList.toggle("hidden", true);
    ui.elements.matchLabel.textContent =
      ui.mode !== "match"
        ? "FREE SWIM"
        : `${sizeLabel(teamSize(app.state.formations[0]))} · ${app.state.formations[0]} / ${app.state.formations[1]}`;
  };
  const enterWithFeedback = (fresh: boolean): void => {
    enter(fresh).catch((error: Error): void => {
      gameTransition.cancel();
      const message = `Could not start the game: ${error.message}. Select Play or Resume to retry.`;
      ui.status.textContent = message;
      getElement("#pause-description", HTMLElement).textContent = message;
      console.error(error);
    });
  };
  let arenaSelection = 0;
  ui.arena.addEventListener("change", (): void => {
    const selection = ++arenaSelection;
    world.arenaRequest++;
    const id = isArenaId(ui.arena.value) ? ui.arena.value : "tropical";
    const alreadyLoaded = world.arena?.id === id;
    ui.start.disabled = true;
    ui.status.textContent = "Loading pool…";
    (alreadyLoaded ? Promise.resolve(true) : setWorldArena(world, id))
      .then((selected): void => {
        if (!selected || selection !== arenaSelection) return;
        ui.start.disabled = false;
        ui.status.textContent = "";
      })
      .catch((error: Error): void => {
        if (selection !== arenaSelection) return;
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
      const openedFromMenu = app.phase === "menu";
      app.phase = "learning";
      input.setActive(false);
      if (!openedFromMenu) app.audio?.setPlaying(false);
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
        if (multiplayer?.active())
          multiplayer.profile({ handedness: ui.handedness });
        else setPlayerHandedness(app.state, ui.handedness);
      },
    );
  getElement("#resume", HTMLButtonElement).addEventListener("click", (): void =>
    enterWithFeedback(false),
  );
  getElement("#restart", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      if (multiplayer?.active()) {
        getElement("#return-menu", HTMLButtonElement).click();
        getElement("#show-multiplayer", HTMLButtonElement).click();
      } else if (learning.active()) {
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
      multiplayer?.leave();
      learning.stop();
      app.phase = "menu";
      input.setActive(false);
      input.clear();
      if (document.pointerLockElement) document.exitPointerLock();
      ui.pause.classList.add("hidden");
      ui.hud.classList.add("hidden");
      ui.menu.classList.remove("hidden");
      ui.menu.dispatchEvent(new Event("lobby-home"));
      if (app.audio) {
        app.audio.setEnabled(ui.sound);
        app.audio.setMenu();
      }
    },
  );
  getElement("#sound", HTMLButtonElement).addEventListener(
    "click",
    (): void => {
      ui.sound = !ui.sound;
      const button = getElement("#sound", HTMLButtonElement);
      button.textContent = ui.sound ? "Sound on" : "Sound off";
      button.setAttribute("aria-pressed", String(ui.sound));
      const audio = prepareAudio();
      if (app.phase === "menu") audio.setMenu();
      else audio.setPlaying(app.phase === "playing");
      audio.context
        .resume()
        .then((): void => audio.setEnabled(ui.sound))
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
      if (ui.music && app.phase === "menu") app.audio?.setMenu();
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
      app.state.players.at(0)?.team === 1 ? "white" : "black";
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
      const human = app.state.players.at(0);
      updateLook(
        input.look,
        input.controls,
        dt,
        human && {
          bodyYaw: human.yaw,
          camera: world.camera.position,
          puck: world.puck.position,
          carrying: app.state.puck.controlOwner === human.id,
        },
      );
      if (multiplayer?.active()) multiplayer.input(input.controls, dt);
    }
    multiplayer?.frame();
    if (app.phase === "playing") {
      app.accumulator +=
        dt *
        (app.state.mode === "playground" && app.state.playground.slowMotion
          ? 0.25
          : 1);
      const steps = multiplayer?.active()
        ? 0
        : Math.min(Math.floor(app.accumulator / STEP), 12);
      if (multiplayer?.active()) app.accumulator = 0;
      const yawShare = steps > 0 ? input.controls.yawDelta / steps : 0;
      for (let step = 0; step < steps; step += 1) {
        if (app.phase !== "playing") break;
        const attemptedGrab = input.controls.knockdown;
        input.controls.yawDelta = yawShare;
        stepSimulation(app.state, input.controls, STEP);
        learning.tick(attemptedGrab, input.controls.glance);
      }
      app.accumulator -= steps * STEP;
      for (const cue of audioEvents.sample(app.state)) app.audio?.play(cue);
      tackleEvents.sample(app.state);
      turnoverBanner.render(ui, app.state, tackleEvents.events());
      const tackleLogVisible = ui.hud.classList.contains("show-tackles");
      const tackleRevision = tackleEvents.revision();
      if (tackleLogVisible && tackleRevision !== app.tackleRevision) {
        const tackleMarkup = tackleEvents
          .events()
          .map(
            (event): string =>
              `<div><b>${event.label}</b> ${event.detail}</div>`,
          )
          .join("");
        app.tackleRevision = tackleRevision;
        ui.elements.tackleLog.innerHTML = tackleMarkup;
      }
      if (app.state.finished) finish();
    }
    const renderDt = (now - app.renderTime) / 1000;
    const idleRenderLimit = app.phase === "menu" ? 31 : 16;
    if (app.phase !== "playing" && renderDt + 0.0015 < 1 / idleRenderLimit)
      return;
    app.renderTime = now;
    world.frameAverage += (renderDt - world.frameAverage) * 0.06;
    world.frameRate = 1 / world.frameAverage;
    renderWorld(
      world,
      app.state,
      now / 1000,
      renderDt,
      app.phase !== "menu",
      input.controls.pitch + input.look.pitch,
      multiplayer?.active()
        ? multiplayer.alpha()
        : app.phase === "playing"
          ? app.accumulator / STEP
          : 1,
      app.phase === "playing" && input.controls.vertical > 0,
      app.phase === "playing" ? input.controls.glance : 0,
      input.look.yaw,
    );
    meter.sample(renderDt * 1000, performance.now() - frameStart);
    if (revealGame && app.phase === "playing") {
      revealGame = false;
      gameTransition.reveal();
    }
    if (
      document.body.classList.contains("show-performance") &&
      now - app.metricsTime > 100
    ) {
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
        multiplayer?.active()
          ? multiplayer.alpha()
          : app.phase === "playing"
            ? app.accumulator / STEP
            : 1,
        world.renderer.getPixelRatio(),
        multiplayer?.names() ?? NO_NAMES,
      );
    if (app.phase !== "menu")
      updateHudValues(
        ui,
        app.state,
        multiplayer?.active() ? multiplayerHud.read(now) : undefined,
        now,
      );
    if (now - app.uiTime > 100 && app.phase !== "menu") {
      updateUI(ui, app.state, input, world, multiplayer?.names() ?? NO_NAMES);
      app.uiTime = now;
    }
  };
  requestAnimationFrame(frame);
  ui.arena.disabled = true;
  await setWorldArena(world, "tropical");
  const homeScreen = document.querySelector<HTMLElement>(
    '[data-screen="mode"]',
  );
  const isHome = (): boolean =>
    app.phase === "menu" &&
    !multiplayer?.active() &&
    !document.hidden &&
    homeScreen?.hidden === false;
  let rotatingBackground = false;
  const backgroundTransition = createBackgroundTransition(
    world.renderer.domElement,
  );
  const backgroundRotation = window.setInterval((): void => {
    if (!isHome() || rotatingBackground) return;
    const index = ARENA_IDS.indexOf(world.arena?.id ?? "tropical");
    const next = ARENA_IDS[(index + 1) % ARENA_IDS.length];
    if (!next) return;
    rotatingBackground = true;
    void setWorldArena(world, next, isHome, async (): Promise<void> => {
      backgroundTransition.capture((): void =>
        world.renderer.render(world.scene, world.camera),
      );
    })
      .catch(console.warn)
      .finally((): void => {
        backgroundTransition.reveal();
        rotatingBackground = false;
      });
  }, 10_000);
  window.addEventListener("pagehide", (event: PageTransitionEvent): void => {
    if (!event.persisted) window.clearInterval(backgroundRotation);
  });
  ui.arena.disabled = false;
  ui.start.disabled = false;
  ui.start.textContent = "Play";
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-game-mode]",
  ))
    button.disabled = false;
  ui.status.textContent = "";
  getElement("#learn-button", HTMLButtonElement).disabled = false;
  getElement("#boot-cover", HTMLElement).classList.add("ready");
  setTimeout((): void => getElement("#boot-cover", HTMLElement).remove(), 400);
  const preparePreviews = (): void => {
    if (app.phase !== "menu") return;
    void import("./arena-previews")
      .then(({ showArenaPreviews }): Promise<void> => showArenaPreviews())
      .catch(console.warn);
  };
  if ("requestIdleCallback" in window)
    window.requestIdleCallback(preparePreviews);
  else setTimeout(preparePreviews, 500);
  multiplayer = bindMultiplayer({
    cancelPreparation: gameTransition.cancel,
    profile: () => ({
      handedness: ui.handedness,
      attributes: ui.attributes,
      autoCurl: ui.autoCurl,
    }),
    prepare: async (room, isCurrent): Promise<void> => {
      await gameTransition.cover();
      if (!isCurrent()) return;
      world.arenaRequest++;
      const arenaReady =
        world.arena?.id === room.arena
          ? Promise.resolve(true)
          : setWorldArena(world, room.arena, isCurrent);
      if (!world.loaded) {
        swimmersLoading ??= loadSwimmers(world).catch((error: unknown) => {
          swimmersLoading = undefined;
          throw error;
        });
      }
      const [selected] = await Promise.all([
        arenaReady,
        swimmersLoading,
        ...[...new Set(room.teamSpecies)].map(loadCharacter),
      ]);
      if (!isCurrent()) return;
      if (!selected) throw new Error("Selected map preparation was superseded");
      await prepareSwimmers(world, createRoomSimulation(room).players);
      if (!isCurrent()) return;
    },
    play: (state): void => {
      app.state = state;
      multiplayerHud.push(state, performance.now());
      ui.mode = "match";
      audioEvents.reset(state);
      const begin = async (): Promise<void> => {
        await enter(false, false);
      };
      void begin().catch((error: unknown): void => {
        gameTransition.cancel();
        console.error(error);
        multiplayer?.leave();
        app.phase = "menu";
        ui.menu.classList.remove("hidden");
        ui.status.textContent =
          "Could not load your character. Please try again.";
      });
    },
    state: (state): void => {
      app.state = state;
      multiplayerHud.push(state, performance.now());
    },
    ended: (): void => {
      getElement("#return-menu", HTMLButtonElement).click();
    },
  });
  const applyProfile = (
    change: Partial<Pick<Player, "attributes" | "autoCurl">>,
  ): void => {
    if (multiplayer?.active()) {
      multiplayer.profile(change);
      return;
    }
    const player = app.state.players.find((candidate) => candidate.human);
    if (player) Object.assign(player, change);
  };
  bindAutoCurlSetting(ui, (autoCurl): void => applyProfile({ autoCurl }));
  bindPlayerBuild(ui, (attributes): void => {
    getElement("#build-note", HTMLElement).hidden = !multiplayer?.buildLocked();
    applyProfile({ attributes });
  });
  if (!location.hash.includes("room=")) learning.offer();
  enableOffline();
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
