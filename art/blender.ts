export const blenderExecutable: string =
  process.env.BLENDER_PATH ??
  (process.platform === "darwin"
    ? "/Applications/Blender.app/Contents/MacOS/Blender"
    : "blender");
