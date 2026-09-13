import {
  type AnimationClip,
  Bone,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  FogExp2,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoToneMapping,
  type Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Quaternion,
  Scene,
  type ShaderMaterial,
  Shape,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import {
  type ArenaId,
  type ArenaView,
  disposeArena,
  loadArena,
} from "./arenas";
import { type Avatar, createAvatar, poseAvatar } from "./avatar";
import { type BubbleField, createBubbles, updateBubbles } from "./bubbles";
import { applyCharacterStyle } from "./character-style";
import {
  applyCharacterVisorReflection,
  createCharacterVisorReflection,
} from "./character-visor";
import { atPlayingDepth } from "./depth";
import { createSwimMotion, type SwimMotion, updateSwimMotion } from "./motion";
import { createShadowTexture, updateShadows } from "./shadows";
import { shareCharacterSkeleton } from "./skeletons";
import {
  bladeMirror,
  bladeOrientation,
  bladeOrigin,
  REST_BLADE_YAW,
  STICK_GRIP,
} from "./stick";
import { type Player, POOL, type Simulation, STICK_OUTLINE } from "./types";
import { captureWater, createWater, type WaterSurface } from "./water";
import { type CameraRig, updateWorldCamera } from "./world-camera";

type SwimmerView = {
  root: Group;
  model: Object3D;
  bones: Map<string, Bone>;
  rests: Map<string, Quaternion>;
  restPositions: Map<string, Vector3>;
  pawSockets: Map<string, Vector3>;
  armLengths: Map<string, number>;
  kickAxes: Map<string, Vector3>;
  stick: Mesh;
  motion: SwimMotion;
  avatar?: Avatar;
};
export type World = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  swimmers: SwimmerView[];
  puck: Group;
  shaders: ShaderMaterial[];
  bubbles: BubbleField;
  water: WaterSurface;
  shadows: InstancedMesh;
  frameRate: number;
  frameAverage: number;
  renderScale: number;
  loaded: boolean;
  lastTime: number;
  trail: Line;
  arena?: ArenaView;
  arenaRequest: number;
  headLift: number;
  reviewCamera?: CameraRig["reviewCamera"];
  visorReflection?: ReturnType<typeof createCharacterVisorReflection>;
};

const material = (
  color: number,
  roughness = 0.65,
  metalness = 0,
): MeshStandardMaterial =>
  new MeshStandardMaterial({ color, roughness, metalness });

const makePuck = (): Group => {
  const group = new Group();
  group.add(
    new Mesh(
      new CylinderGeometry(0.042, 0.042, 0.032, 24),
      material(0xf33c77, 0.6),
    ),
  );
  const top = new Mesh(
    new CylinderGeometry(0.032, 0.032, 0.002, 24),
    material(0xff79a3, 0.65),
  );
  top.position.y = 0.018;
  group.add(top);
  const stripe = new Mesh(
    new BoxGeometry(0.005, 0.002, 0.05),
    material(0xf55c91),
  );
  stripe.position.y = 0.0195;
  group.add(stripe);
  return group;
};

const makeStick = (): Mesh => {
  const shape = new Shape();
  const first = STICK_OUTLINE.at(0);
  if (first) shape.moveTo(first[0], -first[1]);
  for (const point of STICK_OUTLINE.slice(1)) shape.lineTo(point[0], -point[1]);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.017,
    bevelEnabled: true,
    bevelSize: 0.002,
    bevelThickness: 0.002,
    bevelSegments: 1,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -0.0085, 0);
  const stick = new Mesh(
    geometry,
    new MeshStandardMaterial({
      color: 0x161b27,
      roughness: 0.39,
      side: DoubleSide,
    }),
  );
  const recess = new Shape();
  recess.moveTo(-0.128, -0.046);
  recess.quadraticCurveTo(-0.135, -0.02, -0.12, 0.005);
  recess.quadraticCurveTo(-0.107, -0.027, -0.074, -0.04);
  recess.quadraticCurveTo(-0.027, -0.053, 0.004, -0.055);
  recess.quadraticCurveTo(0.01, -0.06, -0.016, -0.061);
  recess.quadraticCurveTo(-0.106, -0.065, -0.128, -0.046);
  const inset = new ExtrudeGeometry(recess, {
    depth: 0.001,
    bevelEnabled: true,
    bevelSize: 0.0015,
    bevelThickness: 0.001,
    bevelSegments: 2,
    steps: 1,
  });
  inset.rotateX(-Math.PI / 2);
  inset.translate(0, 0.0105, 0);
  stick.add(new Mesh(inset, stick.material));
  return stick;
};

export const createWorld = (canvas: HTMLCanvasElement): World => {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x43b5c7);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  const scene = new Scene();
  scene.background = new Color(0x43b5c7);
  scene.fog = new FogExp2(0x43b5c7, 0.026);
  const camera = new PerspectiveCamera(
    77,
    canvas.clientWidth / Math.max(1, canvas.clientHeight),
    0.045,
    800,
  );
  const shaders: ShaderMaterial[] = [];
  const water = createWater();
  scene.add(water.mesh);
  shaders.push(water.mesh.material);
  const puck = makePuck();
  scene.add(puck);
  const bubbles = createBubbles();
  scene.add(bubbles.points);
  const shadowGeometry = new PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const shadows = new InstancedMesh(
    shadowGeometry,
    new MeshBasicMaterial({
      color: 0x145469,
      transparent: true,
      opacity: 0.28,
      map: createShadowTexture(),
      depthWrite: false,
    }),
    13,
  );
  scene.add(shadows);
  const trailGeometry = new BufferGeometry();
  trailGeometry.setAttribute(
    "position",
    new Float32BufferAttribute(new Float32Array(180 * 3), 3),
  );
  const trail = new Line(
    trailGeometry,
    new LineBasicMaterial({
      color: 0xa5f7f1,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  );
  trail.frustumCulled = false;
  scene.add(trail);
  return {
    renderer,
    scene,
    camera,
    swimmers: [],
    arenaRequest: 0,
    headLift: 0,
    puck,
    shaders,
    bubbles,
    water,
    shadows,
    frameRate: 60,
    frameAverage: 1 / 60,
    renderScale: 1.35,
    loaded: false,
    lastTime: 0,
    trail,
  };
};

export const setWorldArena = async (
  world: World,
  id: ArenaId,
): Promise<boolean> => {
  const request = ++world.arenaRequest;
  const arena = await loadArena(id);
  if (request !== world.arenaRequest) {
    disposeArena(arena);
    return false;
  }
  const previous = world.arena;
  if (previous) {
    world.scene.remove(previous.root);
    disposeArena(previous);
  }
  world.arena = arena;
  world.scene.add(arena.root);
  world.scene.background = arena.sky;
  world.scene.backgroundBlurriness = 0;
  world.scene.backgroundIntensity = id === "city" ? 0.85 : 1;
  world.scene.environment = arena.sky;
  world.renderer.shadowMap.needsUpdate = true;
  const tint = world.water.mesh.material.uniforms.uTint;
  if (tint) tint.value = new Color(id === "city" ? 0x187f9e : 0x45c3ce);
  const hidden = [
    world.puck,
    world.shadows,
    world.trail,
    world.bubbles.points,
    ...world.swimmers.flatMap((view): Object3D[] => [
      view.root,
      view.stick,
      ...(view.avatar ? [view.avatar.root] : []),
    ]),
  ];
  const visibility = hidden.map((object): boolean => object.visible);
  for (const object of hidden) object.visible = false;
  captureWater(world.water, world.renderer, world.scene);
  for (const [index, object] of hidden.entries())
    object.visible = visibility.at(index) ?? true;
  await world.renderer.compileAsync(world.scene, world.camera);
  return request === world.arenaRequest;
};

export const createSwimmerView = (
  template: Object3D,
  index: number,
  scene: Scene,
  clips: AnimationClip[] = [],
): SwimmerView => {
  const root = new Group();
  const model = clone(template);
  shareCharacterSkeleton(model);
  const bones = new Map<string, Bone>();
  const rests = new Map<string, Quaternion>();
  const restPositions = new Map<string, Vector3>();
  model.traverse((object: Object3D): void => {
    object.name =
      object instanceof Bone
        ? object.name.replace(/[_.]\d+$/, "").replaceAll(".", "")
        : object.name.replace(/(?:\.|_)?\d{3}$/, "");
    if (object instanceof Bone) {
      bones.set(object.name, object);
      rests.set(object.name, object.quaternion.clone());
      restPositions.set(object.name, object.position.clone());
    }
    if (object instanceof Mesh) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const mapped = materials.map((original: Material): Material => {
        if (!(original instanceof MeshStandardMaterial)) return original;
        const name = original.name.replace(/\.\d{3}$/, "");
        if (name === "Team" || name === "Cap") {
          const changed = original.clone();
          changed.color.set(
            name === "Team"
              ? index < 6
                ? 0x1674c9
                : 0xc52b42
              : index < 6
                ? 0x1674c9
                : 0xc52b42,
          );
          return changed;
        }
        return original;
      });
      object.material = Array.isArray(object.material)
        ? mapped
        : (mapped.at(0) ?? object.material);
      if (object.name === "Stick") object.visible = false;
    }
  });
  root.add(model);
  scene.add(root);
  root.updateMatrixWorld(true);
  const kickAxes = new Map<string, Vector3>();
  const pawSockets = new Map<string, Vector3>();
  const armLengths = new Map<string, number>();
  for (const name of ["pawL", "pawR"]) {
    const bone = bones.get(name);
    if (bone)
      pawSockets.set(
        name,
        new Vector3(0, -0.03, 0).applyQuaternion(
          bone.getWorldQuaternion(new Quaternion()).invert(),
        ),
      );
  }
  for (const side of ["L", "R"]) {
    const arm = bones.get(`arm${side}`);
    const paw = bones.get(`paw${side}`);
    if (arm && paw)
      armLengths.set(
        `arm${side}`,
        arm
          .getWorldPosition(new Vector3())
          .distanceTo(paw.getWorldPosition(new Vector3())),
      );
  }
  for (const [name, bone] of bones)
    kickAxes.set(
      name,
      new Vector3(1, 0, 0).applyQuaternion(
        bone.getWorldQuaternion(new Quaternion()).invert(),
      ),
    );
  const stick = makeStick();
  if (index >= 6 && stick.material instanceof MeshStandardMaterial)
    stick.material.color.set(0xe8e9d5);
  scene.add(stick);
  return {
    root,
    model,
    bones,
    rests,
    restPositions,
    pawSockets,
    armLengths,
    kickAxes,
    stick,
    motion: createSwimMotion(model, clips),
  };
};
export const loadSwimmers = async (world: World): Promise<void> => {
  const loader = new GLTFLoader();
  const [gltf, otter, beaver] = await Promise.all([
    loader.loadAsync("/models/otter-paws.glb"),
    loader.loadAsync("/models/characters/otter.glb"),
    loader.loadAsync("/models/characters/beaver.glb"),
  ]);
  applyCharacterStyle(otter.scene);
  applyCharacterStyle(beaver.scene);
  world.visorReflection = createCharacterVisorReflection(world.renderer);
  applyCharacterVisorReflection(otter.scene, world.visorReflection.texture);
  applyCharacterVisorReflection(beaver.scene, world.visorReflection.texture);
  world.swimmers = Array.from(
    { length: 12 },
    (_: unknown, index: number): SwimmerView => {
      const view = createSwimmerView(gltf.scene, index, world.scene);
      const asset = index < 6 ? otter : beaver;
      view.avatar = createAvatar(asset.scene, asset.animations);
      world.scene.add(view.avatar.root);
      return view;
    },
  );
  world.loaded = true;
  await world.renderer.compileAsync(world.scene, world.camera);
};

const positionHeldStick = (
  view: SwimmerView,
  player: Player,
  alpha: number,
): void => {
  view.stick.quaternion.slerpQuaternions(
    player.previousStickOrientation,
    player.stickOrientation,
    alpha,
  );
  view.stick.scale.set(bladeMirror(player), 1, 1);
  view.stick.position.copy(bladeOrigin(player, view.stick.quaternion)).add(
    player.previousStick
      .clone()
      .sub(player.stick)
      .multiplyScalar(1 - alpha),
  );
  view.stick.updateMatrixWorld(true);
};

export const poseSwimmer = (
  view: SwimmerView,
  player: Player,
  time: number,
  active: boolean,
  alpha = 1,
  firstPerson = active,
): void => {
  positionHeldStick(view, player, alpha);
  if (view.avatar) {
    const localView = player.human && firstPerson;
    const visible = !localView || atPlayingDepth(player);
    view.root.visible = false;
    view.stick.visible = visible;
    view.avatar.root.visible = visible;
    poseAvatar(view.avatar, player, view.stick, time, alpha, localView);
    return;
  }
  view.root.visible = true;
  view.root.position.lerpVectors(player.previous, player.position, alpha);
  view.root.rotation.set(0, player.yaw, player.bodyRoll);
  view.model.rotation.x = player.bodyPitch;
  for (const [name, bone] of view.bones) {
    const rest = view.rests.get(name);
    if (!rest) continue;
    bone.quaternion.copy(rest);
    bone.scale.set(1, 1, 1);
    const position = view.restPositions.get(name);
    if (position) bone.position.copy(position);
    const side = name.endsWith("L") ? 0 : Math.PI;
    const phase =
      (active ? player.kickPhase : time * 4 + player.kickPhase) + side;
    const strength = player.wallReady ? 0 : 0.18 + player.kick * 0.72;
    const amount =
      view.motion.actions.size > 0
        ? 0
        : name.startsWith("thigh")
          ? Math.sin(phase) * 0.23
          : name.startsWith("shin")
            ? Math.sin(phase - 0.7) * 0.18
            : name.startsWith("foot")
              ? Math.sin(phase - 1.2) * 0.16
              : 0;
    if (amount)
      bone.quaternion.multiply(
        new Quaternion().setFromAxisAngle(
          view.kickAxes.get(name) ?? new Vector3(1, 0, 0),
          amount * strength,
        ),
      );
  }
  if (view.motion.actions.size > 0) {
    updateSwimMotion(view.motion, view.bones, player, time);
    view.model.rotation.set(
      view.motion.pitch,
      -view.motion.turn * 0.018,
      view.motion.bank,
    );
  }
  const showEquipment = !player.human || !firstPerson || atPlayingDepth(player);
  view.stick.visible = showEquipment;
  view.model.traverse((object: Object3D): void => {
    if (!(object instanceof Mesh)) return;
    const protectedSide = player.handedness === "right" ? "R" : "L";
    const isMitten =
      object.name.endsWith("Mitten") || object.name.endsWith("Cuff");
    const isBarePaw = /^GripPaw[LR]$/.test(object.name);
    const belongsToProtectedPaw = object.name.startsWith(
      `GripPaw${protectedSide}`,
    );
    object.visible =
      (!isMitten || belongsToProtectedPaw) &&
      (!isBarePaw ||
        !belongsToProtectedPaw ||
        view.motion.actions.size === 0) &&
      (!player.human ||
        !firstPerson ||
        (showEquipment &&
          object.name.startsWith(
            player.handedness === "right" ? "GripPawR" : "GripPawL",
          )));
  });
  view.root.updateMatrixWorld(true);
  const pawName = player.handedness === "right" ? "pawR" : "pawL";
  const paw = view.bones.get(pawName);
  const socket = view.pawSockets.get(pawName);
  if (paw?.parent && socket) {
    const restStick = view.model
      .getWorldQuaternion(new Quaternion())
      .multiply(bladeOrientation(REST_BLADE_YAW * bladeMirror(player), 0));
    const orientation = view.stick.quaternion
      .clone()
      .multiply(restStick.invert())
      .multiply(paw.getWorldQuaternion(new Quaternion()));
    const position = view.stick
      .localToWorld(STICK_GRIP.clone())
      .sub(socket.clone().applyQuaternion(orientation));
    paw.position.copy(paw.parent.worldToLocal(position));
    paw.quaternion.copy(
      paw.parent
        .getWorldQuaternion(new Quaternion())
        .invert()
        .multiply(orientation),
    );
    paw.updateMatrixWorld(true);
  }
  for (const side of ["L", "R"]) {
    const arm = view.bones.get(`arm${side}`);
    const endpoint = view.bones.get(`paw${side}`);
    const length = view.armLengths.get(`arm${side}`);
    if (!arm?.parent || !endpoint || !length) continue;
    const direction = endpoint
      .getWorldPosition(new Vector3())
      .sub(arm.getWorldPosition(new Vector3()));
    const armLength = Math.min(0.13, direction.length());
    const start = endpoint
      .getWorldPosition(new Vector3())
      .addScaledVector(direction.clone().normalize(), -armLength);
    arm.position.copy(arm.parent.worldToLocal(start));
    const restOrientation = arm.getWorldQuaternion(new Quaternion());
    const orientation = new Quaternion()
      .setFromUnitVectors(
        new Vector3(0, 1, 0).applyQuaternion(restOrientation),
        direction.clone().normalize(),
      )
      .multiply(restOrientation);
    arm.quaternion.copy(
      arm.parent
        .getWorldQuaternion(new Quaternion())
        .invert()
        .multiply(orientation),
    );
    arm.scale.y = armLength / length;
    arm.updateMatrixWorld(true);
  }
};

export const resizeWorld = (world: World): void => {
  const canvas = world.renderer.domElement;
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  world.renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, world.renderScale),
  );
  world.renderer.setSize(width, height, false);
  world.camera.aspect = width / height;
  world.camera.updateProjectionMatrix();
};

const updateShaderTime = (
  shaders: readonly ShaderMaterial[],
  time: number,
): void => {
  for (const shader of shaders)
    if (shader.uniforms.uTime) shader.uniforms.uTime.value = time;
};

export const renderWorld = (
  world: World,
  state: Simulation,
  time: number,
  dt: number,
  active: boolean,
  pitch: number,
  alpha = 1,
  liftHead = false,
): void => {
  if (world.arena) world.arena.time.value = time;
  updateShaderTime(world.shaders, time);
  if (world.arena) updateShaderTime(world.arena.shaders, time);
  for (const [index, view] of world.swimmers.entries()) {
    const player = state.players.find(
      (candidate): boolean => candidate.id === index,
    );
    view.root.visible = Boolean(player);
    view.stick.visible = Boolean(player);
    if (view.avatar) view.avatar.root.visible = Boolean(player);
    if (player)
      poseSwimmer(
        view,
        player,
        time,
        active,
        alpha,
        active &&
          (world.reviewCamera?.firstPerson ?? true) &&
          !(state.mode === "playground" && state.playground.camera === "side"),
      );
  }
  world.puck.position.lerpVectors(
    state.puck.previous,
    state.puck.position,
    alpha,
  );
  world.puck.quaternion.slerpQuaternions(
    state.puck.previousOrientation,
    state.puck.orientation,
    alpha,
  );
  world.trail.visible = state.mode === "playground" && active;
  if (world.trail.visible) {
    const positions = world.trail.geometry.getAttribute("position");
    for (const [index, point] of state.playground.trace.entries())
      positions.setXYZ(index, point.x, point.y, point.z);
    positions.needsUpdate = true;
    world.trail.geometry.setDrawRange(0, state.playground.trace.length);
  }
  updateWorldCamera(world, state, dt, active, pitch, alpha, liftHead);
  updateShadows(world.shadows, state);
  updateBubbles(world.bubbles, state.players, dt, time);
  const heightUniform = world.bubbles.points.material.uniforms.uHeight;
  if (heightUniform) heightUniform.value = world.renderer.domElement.height;
  if (world.scene.fog instanceof FogExp2 && world.arena) {
    const above = world.camera.position.y > POOL.depth;
    world.scene.fog.color.copy(above ? world.arena.air : world.arena.fog);
    world.scene.fog.density = above
      ? world.arena.id === "city"
        ? 0.005
        : 0.0018
      : 0.026;
  }
  world.renderer.render(world.scene, world.camera);
};

export const disposeWorld = (world: World): void => {
  world.arenaRequest += 1;
  if (world.arena) {
    world.scene.remove(world.arena.root);
    disposeArena(world.arena);
  }
  world.scene.traverse((object: Object3D): void => {
    if (
      object instanceof Mesh ||
      object instanceof Points ||
      object instanceof Line
    ) {
      object.geometry.dispose();
      const mats = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const mat of mats) mat.dispose();
    }
  });
  world.renderer.dispose();
  if (world.shadows.material instanceof MeshBasicMaterial)
    world.shadows.material.map?.dispose();
  world.water.reflection.dispose();
  world.visorReflection?.dispose();
};
