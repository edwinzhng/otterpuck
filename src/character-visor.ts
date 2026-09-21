import {
  CanvasTexture,
  EquirectangularReflectionMapping,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PMREMGenerator,
  SRGBColorSpace,
  type Texture,
  type WebGLRenderer,
} from "three";

export const createCharacterVisorReflection = (
  renderer: WebGLRenderer,
): { texture: Texture; dispose: () => void } => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Visor reflection canvas unavailable");
  const sky = context.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, "#a5e7ff");
  sky.addColorStop(0.43, "#e4f7ff");
  sky.addColorStop(0.51, "#598fa2");
  sky.addColorStop(1, "#294557");
  context.fillStyle = sky;
  context.fillRect(0, 0, 256, 128);
  context.fillStyle = "#ffffff";
  context.fillRect(36, 23, 52, 13);
  context.fillStyle = "#cbecf8";
  context.fillRect(167, 34, 35, 8);
  const source = new CanvasTexture(canvas);
  source.colorSpace = SRGBColorSpace;
  source.mapping = EquirectangularReflectionMapping;
  const generator = new PMREMGenerator(renderer);
  const reflection = generator.fromEquirectangular(source);
  source.dispose();
  generator.dispose();
  return {
    texture: reflection.texture,
    dispose: (): void => reflection.dispose(),
  };
};

export const applyCharacterVisorReflection = (
  model: Object3D,
  reflection: Texture,
): void => {
  model.traverse((object): void => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of materials) {
      if (
        !(material instanceof MeshStandardMaterial) ||
        !["Lens", "Eyes", "Nose"].includes(material.name)
      )
        continue;
      material.envMap = reflection;
      material.envMapIntensity = material.name === "Eyes" ? 1.2 : 0.9;
      if (material.name === "Lens") material.depthWrite = false;
      if (material.name === "Eyes") material.roughness = 0.16;
      material.needsUpdate = true;
    }
  });
};
