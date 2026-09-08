import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Quaternion,
  type Scene,
  Vector3,
} from "three";

export const addNightArchitecture = (scene: Scene): void => {
  const dark = new MeshStandardMaterial({
    color: 0x08111f,
    roughness: 0.38,
    metalness: 0.45,
  });
  const cyan = new MeshBasicMaterial({ color: 0x56f1ed });
  const pink = new MeshBasicMaterial({ color: 0xff419c });
  const block = (
    size: [number, number, number],
    position: [number, number, number],
    material = dark,
  ): Mesh => {
    const mesh = new Mesh(new BoxGeometry(...size), material);
    mesh.position.set(...position);
    scene.add(mesh);
    return mesh;
  };
  for (const side of [-1, 1]) {
    for (const z of [-12, -6, 0, 6, 12]) {
      block([0.24, 5, 0.24], [side * 9.3, 5, z]);
      const strip = new Mesh(
        new BoxGeometry(0.03, 3.4, 0.06),
        side < 0 ? cyan : pink,
      );
      strip.position.set(side * 9.13, 4.5, z);
      scene.add(strip);
    }
    for (const y of [0.4, 2.18]) {
      const line = new Mesh(
        new BoxGeometry(0.025, 0.035, 24.6),
        side < 0 ? cyan : pink,
      );
      line.position.set(side * 7.478, y, 0);
      scene.add(line);
    }
    const rail = new Mesh(
      new BoxGeometry(0.035, 0.04, 28),
      side < 0 ? cyan : pink,
    );
    rail.position.set(side * 8.4, 3.45, 0);
    scene.add(rail);
    block([0.08, 0.08, 28], [side * 8.4, 2.9, 0]);
    for (const z of [-7, 7]) {
      const light = new PointLight(side < 0 ? 0x33e1ff : 0xec5298, 20, 12, 1.5);
      light.position.set(side * 6.9, 1.5, z);
      scene.add(light);
    }
  }
  for (const z of [-10, 0, 10]) {
    block([19, 0.16, 0.15], [0, 7.1, z]);
    const lamp = new Mesh(new BoxGeometry(10, 0.035, 0.065), cyan);
    lamp.position.set(0, 7, z);
    scene.add(lamp);
  }
  const buildings = new InstancedMesh(new BoxGeometry(1, 1, 1), dark, 28);
  const windows = new InstancedMesh(
    new BoxGeometry(1, 1, 0.04),
    new MeshBasicMaterial({ color: 0xffffff }),
    224,
  );
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  for (const index of Array.from(
    { length: 28 },
    (_: unknown, i: number): number => i,
  )) {
    const side = index < 14 ? -1 : 1;
    const slot = index % 14;
    const height = 7 + ((index * 13) % 15);
    const x = (slot - 6.5) * 3.6;
    const z = side * (26 + (index % 3) * 4);
    matrix.compose(
      new Vector3(x, height / 2 + 1, z),
      rotation,
      new Vector3(2.4, height, 2.3),
    );
    buildings.setMatrixAt(index, matrix);
    for (const floor of Array.from(
      { length: 8 },
      (_: unknown, i: number): number => i,
    )) {
      const windowIndex = index * 8 + floor;
      matrix.compose(
        new Vector3(x, 3 + (floor * (height - 2)) / 8, z - side * 1.17),
        rotation,
        new Vector3(1.4 + (floor % 2) * 0.4, 0.11, 1),
      );
      windows.setMatrixAt(windowIndex, matrix);
      windows.setColorAt(
        windowIndex,
        new Color((floor + index) % 3 === 0 ? 0xbc3eab : 0x39858f),
      );
    }
  }
  scene.add(buildings, windows);
};
