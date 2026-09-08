import {
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import { type Player, POOL } from "./types";

type Bubble = {
  position: Vector3;
  velocity: Vector3;
  age: number;
  lifetime: number;
  radius: number;
  seed: number;
};
export type BubbleField = {
  points: Points<BufferGeometry, ShaderMaterial>;
  bubbles: Bubble[];
  positions: Float32Array;
  opacity: Float32Array;
};

export const createBubbles = (): BubbleField => {
  const bubbles = Array.from(
    { length: 288 },
    (_: unknown, index: number): Bubble => ({
      position: new Vector3(0, -100, 0),
      velocity: new Vector3(),
      age: -((index * 0.6180339) % 1) * 0.2,
      lifetime: 1.5 + ((index * 0.37) % 1) * 2,
      radius: 0.012 + ((index * 0.43) % 1) * 0.034,
      seed: index * 2.39996,
    }),
  );
  const positions = new Float32Array(bubbles.length * 3);
  positions.fill(-100);
  const opacity = new Float32Array(bubbles.length);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aOpacity", new BufferAttribute(opacity, 1));
  geometry.setAttribute(
    "aRadius",
    new BufferAttribute(
      new Float32Array(bubbles.map((bubble: Bubble): number => bubble.radius)),
      1,
    ),
  );
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uHeight: { value: 1000 } },
    vertexShader: `
      attribute float aOpacity;
      attribute float aRadius;
      uniform float uHeight;
      varying float vOpacity;
      void main() {
        vec4 eye = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * eye;
        gl_PointSize = clamp(aRadius * uHeight / max(.1, -eye.z), 2., 30.);
        vOpacity = aOpacity * exp(-max(0., -eye.z) * .025);
      }`,
    fragmentShader: `
      varying float vOpacity;
      void main() {
        vec2 p = gl_PointCoord - .5;
        float r = length(p);
        if (r > .49) discard;
        float rim = smoothstep(.29, .41, r) * (1. - smoothstep(.43, .49, r));
        float shine = exp(-length(p - vec2(-.17, -.2)) * 25.);
        float alpha = (rim * .65 + shine * .85 + .045) * vOpacity;
        gl_FragColor = vec4(mix(vec3(.24,.77,.9), vec3(.88,1.,1.), rim * .5 + shine), alpha);
        #include <colorspace_fragment>
      }`,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, bubbles, positions, opacity };
};

const spawnBubble = (
  bubble: Bubble,
  index: number,
  players: Player[],
  time: number,
): void => {
  const player = players.at(index % players.length);
  if (
    index < Math.min(216, players.length * 18) &&
    player &&
    !player.wallReady &&
    player.position.y < POOL.depth - 0.2
  ) {
    const mouth = new Vector3(Math.sin(bubble.seed) * 0.06, 0.1, -0.73)
      .applyAxisAngle(new Vector3(1, 0, 0), player.bodyPitch)
      .applyAxisAngle(new Vector3(0, 1, 0), player.yaw);
    bubble.position.copy(player.position).add(mouth);
    bubble.velocity.copy(player.velocity).multiplyScalar(0.12);
    bubble.velocity.y = 0.32 + bubble.radius * 8;
    bubble.lifetime =
      player.mode === "ascending" ? 1.8 : 2.3 + Math.sin(bubble.seed) * 0.6;
  } else {
    const jet = index % 8;
    bubble.position.set(
      jet % 2 === 0 ? -6.85 : 6.85,
      0.25,
      (Math.floor(jet / 2) - 1.5) * 6,
    );
    bubble.position.x += Math.sin(bubble.seed + time) * 0.15;
    bubble.position.z += Math.cos(bubble.seed) * 0.18;
    bubble.velocity.set(
      Math.sin(bubble.seed) * 0.025,
      0.45 + bubble.radius * 4,
      0,
    );
    bubble.lifetime = 4;
  }
  bubble.age = 0.001;
};

export const updateBubbles = (
  field: BubbleField,
  players: Player[],
  dt: number,
  time: number,
): void => {
  for (const [index, bubble] of field.bubbles.entries()) {
    bubble.age += dt;
    if (bubble.age < 0) continue;
    if (
      bubble.position.y < -10 ||
      bubble.age > bubble.lifetime ||
      bubble.position.y > POOL.depth + 0.01
    )
      spawnBubble(bubble, index, players, time);
    bubble.position.addScaledVector(bubble.velocity, dt);
    bubble.position.x += Math.sin(time * 2 + bubble.seed) * dt * 0.028;
    bubble.position.z += Math.cos(time * 1.7 + bubble.seed) * dt * 0.022;
    bubble.position.toArray(field.positions, index * 3);
    field.opacity[index] =
      Math.min(1, bubble.age * 5, (bubble.lifetime - bubble.age) * 3) * 0.8;
  }
  field.points.geometry.getAttribute("position").needsUpdate = true;
  field.points.geometry.getAttribute("aOpacity").needsUpdate = true;
};
