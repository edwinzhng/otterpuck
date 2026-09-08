import { DoubleSide, ShaderMaterial } from "three";

export const createOceanSurface = (): ShaderMaterial =>
  new ShaderMaterial({
    side: DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position,1.);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`,
    fragmentShader: `varying vec3 vWorld; uniform float uTime;
  void main() {
    float distanceToEye = length(vWorld.xz-cameraPosition.xz);
    float ripples = sin(vWorld.x*.36+sin(vWorld.z*.24+uTime*.12))
      + sin(vWorld.z*1.7+sin(vWorld.x*.71)-uTime*.25);
    float crest = smoothstep(1.1,1.9,ripples) * exp(-distanceToEye*.011);
    vec3 nearColor = mix(vec3(.025,.36,.49),vec3(.07,.56,.62),.5+.5*sin(vWorld.z*.035));
    vec3 color = mix(nearColor,vec3(.39,.70,.79),smoothstep(35.,210.,distanceToEye));
    color += vec3(.12,.20,.19)*crest*.45;
    gl_FragColor=vec4(color,1.);
    #include <colorspace_fragment>
  }`,
  });
