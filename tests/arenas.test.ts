import { expect, test } from "bun:test";
import { Mesh, Raycaster, Vector3 } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

for (const name of ["tropical", "city"]) {
  test(`${name} GLB leaves the regulation pool clear, keeps the trough low, and batches scenery`, async (): Promise<void> => {
    const data = await Bun.file(
      new URL(`../public/models/arenas/${name}.glb`, import.meta.url),
    ).arrayBuffer();
    const gltf = await new GLTFLoader().parseAsync(data, "");
    gltf.scene.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    gltf.scene.traverse((object): void => {
      if (object instanceof Mesh) meshes.push(object);
    });
    const triangles = meshes.reduce(
      (sum, mesh): number =>
        sum +
        (mesh.geometry.index?.count ??
          mesh.geometry.getAttribute("position").count) /
          3,
      0,
    );
    expect(meshes.length).toBeLessThan(26);
    expect(triangles).toBeLessThan(100_000);
    const materials = new Set(
      meshes.flatMap((mesh): string[] =>
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(
          (material): string => material.name,
        ),
      ),
    );
    expect(materials.has("Pool floor")).toBe(true);
    expect(materials.has("Pool wall")).toBe(true);
    expect(materials.has("Pool marking")).toBe(true);
    expect(materials.has("Trough steel")).toBe(true);
    for (const x of [-7, -3, 0, 3, 7])
      for (const z of [-11.5, -6, 0, 6, 11.5]) {
        const ray = new Raycaster(
          new Vector3(x, 2.3, z),
          new Vector3(0, -1, 0),
        );
        const hit = ray.intersectObject(gltf.scene, true).at(0);
        expect(hit).toBeDefined();
        expect(hit?.point.y).toBeLessThan(0.02);
      }
    for (const side of [-1, 1]) {
      for (const x of [-6, 0, 6]) {
        const wallRay = new Raycaster(
          new Vector3(x, 2.28, side * 10),
          new Vector3(0, 0, side),
        );
        const walls = wallRay.intersectObject(gltf.scene, true);
        const first = walls.at(0);
        expect(first?.distance).toBeCloseTo(2.5, 3);
        const differentSurface = walls.find(
          (hit): boolean => hit.object !== first?.object,
        );
        if (first && differentSurface)
          expect(differentSurface.distance - first.distance).toBeGreaterThan(
            0.12,
          );
      }
      const ray = new Raycaster(
        new Vector3(0, 1, side * 12.3),
        new Vector3(0, -1, 0),
      );
      const hit = ray.intersectObject(gltf.scene, true).at(0);
      expect(hit?.point.y).toBeGreaterThan(0.01);
      expect(hit?.point.y).toBeLessThan(0.06);
    }
    console.info(
      `${name}: ${meshes.length} material batches, ${Math.round(triangles).toLocaleString()} triangles`,
    );
  });
}
