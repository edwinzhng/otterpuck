import { CHARACTER_SPECIES } from "./characters";

export const offlineShell = [
  "/manifest.webmanifest",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/icons/otterpuck-192.png",
  "/icons/otterpuck-512.png",
] as const;

export const runtimeContent = [
  "/models/otter-paws.glb",
  ...CHARACTER_SPECIES.map(
    (species): string => `/models/characters/${species}.glb`,
  ),
  ...ARENA_IDS.map((id): string => `/models/arenas/${id}.glb`),
  ...ARENA_IDS.map((id): string => `/art/arenas/${id}-panorama-painted.webp`),
  "/art/arenas/island-rock-painted.webp",
  "/art/learn/dummy-toon-v1.webp",
  "/art/learn/curl-toon-v1.webp",
  "/art/learn/shot-toon-v1.webp",
  "/audio/dive.wav",
  "/audio/surface.wav",
  "/audio/menu-click.mp3",
  "/audio/menu.m4a",
  "/audio/menu-2.m4a",
  "/audio/electric-stream.m4a",
  "/audio/electric-stream-2.m4a",
] as const;

import { ARENA_IDS } from "./arena-catalog";
