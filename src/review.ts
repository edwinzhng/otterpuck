import { Vector3 } from "three";
import {
  createSimulation,
  resetPracticePuck,
  stepSimulation,
} from "./simulation";
import { freshControls, STEP } from "./types";
import {
  createWorld,
  disposeWorld,
  loadSwimmers,
  renderWorld,
  resizeWorld,
  setWorldArena,
} from "./world";

export const bootReview = async (): Promise<void> => {
  document.body.innerHTML = `<canvas id="pool" aria-label="Otterpuck gameplay movement review"></canvas>
    <div class="review-toolbar"><a href="/">OTTERPUCK</a>
    <label>Arena <select id="review-arena"><option value="tropical">Tropical Cove</option><option value="city">Neon Rooftop</option></select></label><label>Movement <select id="movement"><option>Swim</option><option>Sprint</option><option>Floor swim</option><option>Floor sprint</option><option>Floor bank left</option><option>Floor bank right</option><option>Swim up</option><option>Dive down</option><option>Bank left</option><option>Bank right</option><option>Glide</option><option>Brake</option><option>Reach</option><option>Puck</option><option>Goal</option><option>Curl</option><option>Reverse curl</option><option>Swerve left</option><option>Swerve right</option></select></label>
    <label>Species <select id="review-species"><option value="otter">Otter</option><option value="beaver">Beaver</option></select></label>
    <label>Camera <select id="camera"><option>Side</option><option>Three quarter</option><option>Toward</option><option>Away</option><option>Above</option><option>Below</option><option>Gameplay</option><option>Surface</option><option>Arena</option><option>Trough</option><option>End wall</option><option>Opposite wall</option></select></label>
    <button id="freeze">Pause motion</button><button id="reset">Restart movement</button><button id="capture">Capture frame</button><a id="frame-download" hidden>Save PNG</a><output id="review-status">Loading the game assets…</output></div>`;
  const canvas = document.querySelector("canvas");
  const movement = document.querySelector("#movement");
  const camera = document.querySelector("#camera");
  const status = document.querySelector("#review-status");
  const freeze = document.querySelector("#freeze");
  const species = document.querySelector("#review-species");
  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(movement instanceof HTMLSelectElement) ||
    !(camera instanceof HTMLSelectElement) ||
    !(status instanceof HTMLOutputElement) ||
    !(freeze instanceof HTMLButtonElement) ||
    !(species instanceof HTMLSelectElement)
  )
    throw new Error("Movement review controls missing");
  const world = createWorld(canvas);
  const floorMoves = [
    "Puck",
    "Goal",
    "Curl",
    "Reverse curl",
    "Swerve left",
    "Swerve right",
  ];
  world.renderScale = 1.35;
  resizeWorld(world);
  const review = {
    state: createSimulation("2-3-1", "2-3-1", "playground"),
    elapsed: 0,
    previous: 0,
    accumulator: 0,
    paused: false,
    frames: 0,
    frameTime: 0,
    capture: false,
  };
  const reset = (): void => {
    review.state = createSimulation(
      "2-3-1",
      "2-3-1",
      "playground",
      180,
      "right",
      {
        species: species.value === "beaver" ? "beaver" : "otter",
        position: 0,
        difficulty: "medium",
      },
    );
    const player = review.state.players.at(0);
    if (!player) return;
    player.position.set(
      0,
      movement.value === "Dive down"
        ? 1.95
        : floorMoves.includes(movement.value) ||
            movement.value.startsWith("Floor ")
          ? 0.36
          : 1.05,
      movement.value === "Goal" ? (player.team === 0 ? -10.7 : 10.7) : 3,
    );
    player.previous.copy(player.position);
    resetPracticePuck(review.state);
    review.elapsed = 0;
    review.accumulator = 0;
    if (floorMoves.includes(movement.value)) camera.value = "Gameplay";
  };
  movement.addEventListener("change", reset);
  species.addEventListener("change", reset);
  document.querySelector("#reset")?.addEventListener("click", reset);
  document.querySelector("#capture")?.addEventListener("click", (): void => {
    review.capture = true;
  });
  freeze.addEventListener("click", (): void => {
    review.paused = !review.paused;
    freeze.textContent = review.paused ? "Resume motion" : "Pause motion";
  });
  window.addEventListener("resize", (): void => resizeWorld(world));
  window.addEventListener("pagehide", (): void => disposeWorld(world));
  reset();
  await setWorldArena(world, "tropical");
  await loadSwimmers(world);
  document
    .querySelector("#review-arena")
    ?.addEventListener("change", (event): void => {
      if (!(event.target instanceof HTMLSelectElement)) return;
      setWorldArena(
        world,
        event.target.value === "city" ? "city" : "tropical",
      ).catch(console.error);
    });
  const offsets = new Map<string, Vector3>([
    ["Side", new Vector3(1.55, 0.32, 0)],
    ["Three quarter", new Vector3(1.1, 0.38, -1.25)],
    ["Toward", new Vector3(0, 0.17, -1.8)],
    ["Away", new Vector3(0, 0.35, 1.8)],
    ["Above", new Vector3(0.1, 1.1, 0.3)],
    ["Below", new Vector3(0, -0.8, -0.5)],
  ]);
  const frame = (now: number): void => {
    requestAnimationFrame(frame);
    if (
      now - review.previous < (review.paused ? 1000 / 30 : 1000 / 60) - 1.5 &&
      !review.capture
    )
      return;
    const dt = Math.min(0.08, (now - review.previous) / 1000);
    review.previous = now;
    if (document.hidden) return;
    const player = review.state.players.at(0);
    if (!player) return;
    if (!review.paused) {
      review.accumulator += dt;
      for (const unused of Array.from({
        length: Math.min(12, Math.floor(review.accumulator / STEP)),
      })) {
        void unused;
        const controls = freshControls();
        controls.forward = [...floorMoves, "Glide", "Reach"].includes(
          movement.value,
        )
          ? 0
          : 0.75;
        if (movement.value === "Brake" && review.elapsed > 0.8)
          controls.forward = -1;
        controls.sprint =
          movement.value === "Sprint" || movement.value === "Floor sprint";
        controls.vertical =
          movement.value === "Swim up"
            ? 1
            : movement.value === "Dive down"
              ? -1
              : 0;
        controls.yawDelta =
          movement.value === "Bank left" || movement.value === "Floor bank left"
            ? STEP * 1.9
            : movement.value === "Bank right" ||
                movement.value === "Floor bank right"
              ? -STEP * 1.9
              : 0;
        controls.knockdown = movement.value === "Reach";
        controls.curl =
          movement.value === "Curl"
            ? 1
            : movement.value === "Reverse curl"
              ? -1
              : 0;
        if (movement.value.startsWith("Swerve ")) {
          controls.forward = review.elapsed < 1.7 ? 0.5 : 0;
          controls.dummy =
            review.elapsed >= 0.2 && review.elapsed < 1.1
              ? movement.value === "Swerve left"
                ? -1
                : 1
              : 0;
          controls.lateral = controls.dummy;
        }
        stepSimulation(review.state, controls, STEP);
        review.elapsed += STEP;
        review.accumulator -= STEP;
      }
    }
    const target = player.position.clone().add(new Vector3(0, 0.02, -0.04));
    const position = target
      .clone()
      .add(
        (offsets.get(camera.value) ?? new Vector3(0, 1, 2))
          .clone()
          .applyAxisAngle(new Vector3(0, 1, 0), player.yaw),
      );
    if (camera.value === "Surface") {
      position.set(6, 2.72, 10);
      target.set(-1, 3.7, -16);
    }
    if (camera.value === "Arena") {
      position.set(25, 24, 33);
      target.set(0, 2, -3);
    }
    if (camera.value === "Trough") {
      const side = player.team === 0 ? -1 : 1;
      position.set(2.8, 0.75, side * 9.3);
      target.set(0, 0.1, side * 12.3);
    }
    if (camera.value === "End wall" || camera.value === "Opposite wall") {
      const side = camera.value === "End wall" ? 1 : -1;
      position.set(1.4 + Math.sin(review.state.time) * 0.2, 1.8, side * 10.7);
      target.set(0, 2.2, side * 12.5);
    }
    world.reviewCamera = {
      position,
      target,
      firstPerson: camera.value === "Gameplay",
    };
    renderWorld(
      world,
      review.state,
      review.state.time,
      review.paused ? 0 : dt,
      true,
      -0.48,
      1,
    );
    if (review.capture) {
      const link = document.querySelector("#frame-download");
      if (link instanceof HTMLAnchorElement) {
        link.href = canvas.toDataURL("image/png");
        link.download = `otterpuck-${world.arena?.id}-${species.value}-${camera.value}.png`;
        link.hidden = false;
      }
      review.capture = false;
    }
    review.frames += 1;
    review.frameTime += dt;
    if (review.frameTime > 0.8) {
      status.value = `${movement.value} · ${Math.round(review.frames / review.frameTime)} fps · ${world.renderer.info.render.calls} draws · ${Math.round(world.renderer.info.render.triangles / 1000)}k triangles`;
      review.frames = 0;
      review.frameTime = 0;
    }
    if (
      !review.paused &&
      review.elapsed >
        (["Swim up", "Dive down"].includes(movement.value) ? 1.9 : 4.5)
    )
      reset();
  };
  requestAnimationFrame(frame);
};
