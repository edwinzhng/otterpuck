import { type GLTF, GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { CharacterSpecies } from "../characters";

const files = new Map<string, Promise<ArrayBuffer>>();

const load = async (path: string): Promise<GLTF> => {
  let bytes = files.get(path);
  if (!bytes) {
    bytes = Bun.file(path).arrayBuffer();
    files.set(path, bytes);
  }
  return new GLTFLoader().parseAsync(await bytes, "");
};

export const loadFirstPersonModel = (): Promise<GLTF> =>
  load("public/models/otter-paws.glb");

export const loadCharacterModel = (species: CharacterSpecies): Promise<GLTF> =>
  load(`public/models/characters/${species}.glb`);
