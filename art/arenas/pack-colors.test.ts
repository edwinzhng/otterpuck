import { expect, test } from "bun:test";
import { Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { packArenaColors } from "./pack-colors";

test("float arena paint becomes normalized 16-bit color without moving vertices", async () => {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const colors = new Float32Array([
    0, 0.12345, 1, 1, 0.5, 0.77777, 0.25, 1, 0.02, 0.93, 0.33333, 1,
  ]);
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, COLOR_0: 1 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      { bufferView: 1, componentType: 5126, count: 3, type: "VEC4" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
      {
        buffer: 0,
        byteOffset: positions.byteLength,
        byteLength: colors.byteLength,
      },
    ],
    buffers: [{ byteLength: positions.byteLength + colors.byteLength }],
  };
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = Math.ceil(json.byteLength / 4) * 4;
  const binaryLength = positions.byteLength + colors.byteLength;
  const source = new Uint8Array(28 + jsonLength + binaryLength);
  const header = new DataView(source.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, source.byteLength, true);
  header.setUint32(12, jsonLength, true);
  header.setUint32(16, 0x4e4f534a, true);
  source.fill(32, 20, 20 + jsonLength);
  source.set(json, 20);
  header.setUint32(20 + jsonLength, binaryLength, true);
  header.setUint32(24 + jsonLength, 0x004e4942, true);
  source.set(new Uint8Array(positions.buffer), 28 + jsonLength);
  source.set(
    new Uint8Array(colors.buffer),
    28 + jsonLength + positions.byteLength,
  );
  const packed = packArenaColors(source);
  const result = await new GLTFLoader().parseAsync(packed.slice().buffer, "");
  const mesh = result.scene.children[0];
  if (!(mesh instanceof Mesh)) throw new Error("Expected the fixture triangle");
  expect(mesh.geometry.getAttribute("position").array).toEqual(positions);
  const color = mesh.geometry.getAttribute("color");
  expect(color.array).toBeInstanceOf(Uint16Array);
  expect(color.normalized).toBe(true);
  for (const [index, value] of colors.entries())
    expect(
      Math.abs(Number(color.array[index]) / 65535 - value),
    ).toBeLessThanOrEqual(0.5 / 65535);
  expect(packArenaColors(packed)).toEqual(packed);
});

test("packed arena paint preserves geometry and stays within one 16-bit step", async () => {
  const source = new Uint8Array(
    await Bun.file(
      new URL("../../public/models/arenas/tropical.glb", import.meta.url),
    ).arrayBuffer(),
  );
  const packed = packArenaColors(source);
  const loader = new GLTFLoader();
  const original = await loader.parseAsync(source.buffer, "");
  const result = await loader.parseAsync(packed.slice().buffer, "");
  const meshes = (root: typeof original.scene): Mesh[] => {
    const found: Mesh[] = [];
    root.traverse((object) => {
      if (object instanceof Mesh) found.push(object);
    });
    return found;
  };
  const before = meshes(original.scene);
  const after = meshes(result.scene);
  expect(after.length).toBe(before.length);
  for (const [index, mesh] of after.entries()) {
    const previous = before.at(index);
    if (!previous) throw new Error("Packing added an unexpected mesh");
    expect(mesh.geometry.index?.array).toEqual(previous.geometry.index?.array);
    expect(mesh.geometry.getAttribute("position").array).toEqual(
      previous.geometry.getAttribute("position").array,
    );
    const color = mesh.geometry.getAttribute("color");
    const old = previous.geometry.getAttribute("color");
    if (!old) continue;
    expect(color.array).toBeInstanceOf(Uint16Array);
    expect(color.count).toBe(old.count);
    for (let vertex = 0; vertex < color.count; vertex++)
      for (let component = 0; component < color.itemSize; component++)
        expect(
          Math.abs(
            color.getComponent(vertex, component) -
              old.getComponent(vertex, component),
          ),
        ).toBeLessThanOrEqual(1 / 65535);
  }
  expect(packed.byteLength).toBeLessThanOrEqual(source.byteLength);
  expect(packArenaColors(packed)).toEqual(packed);
});
