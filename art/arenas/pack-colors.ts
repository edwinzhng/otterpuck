type Accessor = {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  normalized?: boolean;
  sparse?: unknown;
  min?: number[];
  max?: number[];
};
type ArenaDocument = {
  accessors: Accessor[];
  bufferViews: {
    buffer: number;
    byteOffset?: number;
    byteLength: number;
    byteStride?: number;
  }[];
  buffers: { byteLength: number }[];
  meshes: { primitives: { attributes: Record<string, number> }[] }[];
};

const aligned = (size: number): number => Math.ceil(size / 4) * 4;

// Normalized 16-bit vertex paint needs no decoder extension and retains linear color precision.
export const packArenaColors = (source: Uint8Array): Uint8Array => {
  const header = new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength,
  );
  if (header.getUint32(0, true) !== 0x46546c67)
    throw new Error("Expected a binary glTF arena");
  const jsonSize = header.getUint32(12, true);
  const document = JSON.parse(
    new TextDecoder().decode(source.subarray(20, 20 + jsonSize)),
  ) as ArenaDocument;
  const binary = source.subarray(28 + jsonSize);
  const colors = new Set(
    document.meshes.flatMap((mesh) =>
      mesh.primitives.flatMap((primitive) => {
        const index = primitive.attributes.COLOR_0;
        return index === undefined ? [] : [index];
      }),
    ),
  );
  const replacements = new Map<number, Uint8Array>();
  for (const index of colors) {
    const accessor = document.accessors.at(index);
    const viewIndex = accessor?.bufferView;
    const view =
      viewIndex === undefined ? undefined : document.bufferViews.at(viewIndex);
    if (
      !accessor ||
      viewIndex === undefined ||
      !view ||
      accessor.componentType !== 5126 ||
      accessor.sparse ||
      accessor.byteOffset ||
      accessor.min ||
      accessor.max ||
      view.byteStride ||
      !["VEC3", "VEC4"].includes(accessor.type) ||
      document.accessors.some(
        (other, otherIndex) =>
          other.bufferView === viewIndex && !colors.has(otherIndex),
      )
    )
      continue;
    const count = accessor.count * (accessor.type === "VEC4" ? 4 : 3);
    if (view.byteLength !== count * 4) continue;
    const values = new DataView(
      binary.buffer,
      binary.byteOffset + (view.byteOffset ?? 0),
      view.byteLength,
    );
    const packed = new Uint8Array(count * 2);
    const output = new DataView(packed.buffer);
    for (let component = 0; component < count; component++) {
      const value = values.getFloat32(component * 4, true);
      if (!Number.isFinite(value) || value < 0 || value > 1)
        throw new Error("Arena vertex colors must be within 0–1");
      output.setUint16(component * 2, Math.round(value * 65535), true);
    }
    replacements.set(viewIndex, packed);
    accessor.componentType = 5123;
    accessor.normalized = true;
  }
  let offset = 0;
  const chunks = document.bufferViews.map((view, index) => {
    const start = view.byteOffset ?? 0;
    const bytes =
      replacements.get(index) ??
      binary.subarray(start, start + view.byteLength);
    view.byteOffset = offset;
    view.byteLength = bytes.byteLength;
    offset += aligned(bytes.byteLength);
    return bytes;
  });
  const buffer = document.buffers.at(0);
  if (!buffer || document.buffers.length !== 1)
    throw new Error("Arena export must use one embedded buffer");
  buffer.byteLength = offset;
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = aligned(json.byteLength);
  const result = new Uint8Array(28 + jsonLength + offset);
  const resultHeader = new DataView(result.buffer);
  resultHeader.setUint32(0, 0x46546c67, true);
  resultHeader.setUint32(4, 2, true);
  resultHeader.setUint32(8, result.byteLength, true);
  resultHeader.setUint32(12, jsonLength, true);
  resultHeader.setUint32(16, 0x4e4f534a, true);
  result.fill(32, 20, 20 + jsonLength);
  result.set(json, 20);
  resultHeader.setUint32(20 + jsonLength, offset, true);
  resultHeader.setUint32(24 + jsonLength, 0x004e4942, true);
  for (const [index, bytes] of chunks.entries())
    result.set(
      bytes,
      28 + jsonLength + (document.bufferViews.at(index)?.byteOffset ?? 0),
    );
  return result;
};
