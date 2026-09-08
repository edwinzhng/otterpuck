import {
  Color,
  CubeCamera,
  DoubleSide,
  LinearMipmapLinearFilter,
  Mesh,
  PlaneGeometry,
  type Scene,
  ShaderMaterial,
  Vector3,
  WebGLCubeRenderTarget,
  type WebGLRenderer,
} from "three";
import { POOL } from "./types";

export type WaterSurface = {
  mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  reflection: WebGLCubeRenderTarget;
  capture: CubeCamera;
};

export const createWater = (): WaterSurface => {
  const reflection = new WebGLCubeRenderTarget(256, {
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
  });
  const capture = new CubeCamera(0.1, 800, reflection);
  capture.position.set(0, POOL.depth + 0.1, 0);
  const geometry = new PlaneGeometry(POOL.width, POOL.length, 56, 88);
  geometry.rotateX(-Math.PI / 2);
  const material = new ShaderMaterial({
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: new Color(0x45c3ce) },
      uReflection: { value: reflection.texture },
      uCapture: { value: new Vector3(0, POOL.depth, 0) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 p = position;
        float a = p.x * 1.3 + p.z * .45 + uTime * .85;
        float b = p.z * 1.85 - p.x * .72 - uTime * .65;
        float c = p.x * 4.2 + p.z * 3.4 + uTime * 1.1;
        p.y += sin(a) * .014 + sin(b) * .009 + sin(c) * .0015;
        float dx = cos(a) * .0182 - cos(b) * .00648 + cos(c) * .0063;
        float dz = cos(a) * .0063 + cos(b) * .01665 + cos(c) * .0051;
        vNormal = normalize(vec3(-dx, 1., -dz));
        vec4 world = modelMatrix * vec4(p, 1.);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: `
      uniform samplerCube uReflection;
      uniform vec3 uTint;
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 micro = vec3(sin(vWorld.z * 12. + uTime * 1.4), 0., cos(vWorld.x * 11. - uTime * 1.1)) * .004;
        vec3 normal = normalize(vNormal + micro);
        bool below = cameraPosition.y < vWorld.y;
        if (below) normal = -normal;
        float cosine = clamp(dot(view, normal), 0., 1.);
        float fresnel = .02 + .98 * pow(1. - cosine, 5.);
        float snellWindow = smoothstep(.64, .76, cosine);
        float reflectivity = below ? mix(.97, fresnel, snellWindow) : fresnel;
        vec3 direction = reflect(-view, normal);
        vec3 reflection = textureCube(uReflection, direction).rgb;
        vec3 transmission = uTint;
        vec3 color = mix(transmission, reflection * vec3(.72,.97,1.04), reflectivity);
        float glint = pow(max(0., dot(reflect(normalize(vec3(.3,-1.,.25)), normal), view)), 150.);
        color += vec3(.42,.89,1.) * glint * .4;
        float alpha = mix(.16, .94, reflectivity);
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new Mesh(geometry, material);
  mesh.position.y = POOL.depth;
  return { mesh, reflection, capture };
};

export const captureWater = (
  water: WaterSurface,
  renderer: WebGLRenderer,
  scene: Scene,
): void => {
  const fog = scene.fog;
  water.mesh.visible = false;
  scene.fog = null;
  water.capture.update(renderer, scene);
  scene.fog = fog;
  water.mesh.visible = true;
};
