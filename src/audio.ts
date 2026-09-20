import { assetUrl } from "./asset-url";
import { createEffectBuffers } from "./audio-effects";
import type { AudioCue } from "./audio-events";

export type PoolAudio = {
  context: AudioContext;
  setEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setVolume: (kind: "music" | "effects", volume: number) => void;
  setMenu: () => void;
  startGameplayMusic: () => void;
  setPlaying: (playing: boolean) => void;
  click: () => void;
  play: (cue: AudioCue) => void;
  dispose: () => void;
};

export const createAudio = (): PoolAudio => {
  const context = new AudioContext();
  const master = context.createGain();
  const effects = context.createGain();
  const limiter = context.createDynamicsCompressor();
  master.gain.value = 0;
  effects.gain.value = 0.85;
  limiter.threshold.value = -5;
  limiter.knee.value = 4;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  effects.connect(master);
  master.connect(limiter);
  limiter.connect(context.destination);
  const musicGain = context.createGain();
  musicGain.gain.value = 0.21 * 0.56;
  musicGain.connect(limiter);
  type MusicTrack = {
    buffer?: AudioBuffer;
    source?: AudioBufferSourceNode;
    offset: number;
    started: number;
    loading: boolean;
    gain: GainNode;
    url: string;
    volume: number;
    fadeTimer?: number;
  };
  const track = (url: string, volume: number): MusicTrack => {
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(musicGain);
    return { offset: 0, started: 0, loading: false, gain, url, volume };
  };
  const musicTracks = {
    menu: track("/audio/menu.m4a", 1.584),
    menuAlt: track("/audio/menu-2.m4a", 1.584),
    game: track("/audio/electric-stream.m4a", 1.2),
    gameAlt: track("/audio/electric-stream-2.m4a", 1.2),
  };
  type MusicName = keyof typeof musicTracks;
  const menuTracks = ["menu", "menuAlt"] as const;
  const gameTracks = ["game", "gameAlt"] as const;
  let menuTrack = Math.floor(Math.random() * menuTracks.length);
  let gameTrack = 0;
  const buffers = createEffectBuffers(context);
  const loading = new AbortController();
  const voices = new Set<AudioBufferSourceNode>();
  const sound = {
    enabled: false,
    music: true,
    playing: false,
    disposed: false,
    variation: 0,
    musicVolume: 0.5,
    musicDucked: false,
    musicScene: "off" as "off" | "menu" | "game",
  };
  const selectedMusic = (): MusicName =>
    sound.musicScene === "menu" ? menuTracks[menuTrack] : gameTracks[gameTrack];
  const musicLevel = (ducked = sound.musicDucked): number =>
    sound.musicVolume * 0.42 * 0.56 * (ducked ? 0.6 : 1);
  const setMusicDuck = (ducked: boolean, delay = 0): void => {
    if (ducked && sound.musicDucked) return;
    const now = context.currentTime;
    const current = musicGain.gain.value;
    sound.musicDucked = ducked;
    if (ducked) {
      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(current, now);
      musicGain.gain.linearRampToValueAtTime(musicLevel(true), now + 1);
      return;
    }
    const at = now + delay;
    musicGain.gain.cancelScheduledValues(at);
    musicGain.gain.setValueAtTime(musicLevel(true), at);
    musicGain.gain.linearRampToValueAtTime(musicLevel(false), at + 1);
  };
  for (const [kind, path] of [
    ["dive", "/audio/dive.wav"],
    ["surface", "/audio/surface.wav"],
    ["click-0", "/audio/menu-click.mp3"],
  ] as const) {
    fetch(assetUrl(path), { signal: loading.signal })
      .then((response): Promise<ArrayBuffer> => {
        if (!response.ok) throw new Error(`Audio ${kind}: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data): Promise<AudioBuffer> => context.decodeAudioData(data))
      .then((buffer): void => {
        if (!sound.disposed) buffers.set(kind, buffer);
      })
      .catch((error: Error): void => {
        if (!sound.disposed)
          console.warn("Sound effect could not load", error.message);
      });
  }
  const stopTrack = (music: MusicTrack): void => {
    if (music.fadeTimer !== undefined) window.clearTimeout(music.fadeTimer);
    music.fadeTimer = undefined;
    const source = music.source;
    if (!source) return;
    music.offset =
      (music.offset + context.currentTime - music.started) %
      (music.buffer?.duration ?? 1);
    music.source = undefined;
    source.stop();
    source.disconnect();
  };
  const stopMusic = (): void => {
    for (const music of Object.values(musicTracks)) stopTrack(music);
  };
  const loadTrack = (music: MusicTrack): void => {
    if (music.buffer || music.loading) return;
    music.loading = true;
    void fetch(assetUrl(music.url), { signal: loading.signal })
      .then((response): Promise<ArrayBuffer> => {
        if (!response.ok) throw new Error(`Music: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data): Promise<AudioBuffer> => context.decodeAudioData(data))
      .then((buffer): void => {
        if (sound.disposed) return;
        music.buffer = buffer;
        music.loading = false;
        syncPlayback();
      })
      .catch((error: Error): void => {
        music.loading = false;
        if (!sound.disposed)
          console.warn("Music could not load", error.message);
      });
  };
  const startTrack = (name: MusicName, music: MusicTrack): void => {
    if (music.source || !music.buffer) return;
    const source = context.createBufferSource();
    source.buffer = music.buffer;
    source.loop = false;
    source.connect(music.gain);
    music.started = context.currentTime;
    music.source = source;
    source.onended = (): void => {
      source.disconnect();
      if (music.source !== source) return;
      music.source = undefined;
      music.offset = 0;
      if (sound.musicScene === "menu" && name === menuTracks[menuTrack]) {
        menuTrack = (menuTrack + 1) % menuTracks.length;
        syncPlayback();
      } else if (
        sound.musicScene === "game" &&
        name === gameTracks[gameTrack]
      ) {
        gameTrack = (gameTrack + 1) % gameTracks.length;
        syncPlayback();
      }
    };
    source.start(0, music.offset);
  };
  const syncPlayback = (fadeSeconds = 1): void => {
    if (sound.disposed) return;
    const wanted =
      sound.enabled &&
      sound.music &&
      sound.musicScene !== "off" &&
      !document.hidden;
    if (!wanted) {
      stopMusic();
      return;
    }
    const now = context.currentTime;
    const selected = selectedMusic();
    for (const [name, music] of Object.entries(musicTracks)) {
      loadTrack(music);
      const active = name === selected;
      if (active) {
        if (music.fadeTimer !== undefined) window.clearTimeout(music.fadeTimer);
        music.fadeTimer = undefined;
        startTrack(name as MusicName, music);
      }
      music.gain.gain.cancelScheduledValues(now);
      music.gain.gain.setValueAtTime(music.gain.gain.value, now);
      music.gain.gain.linearRampToValueAtTime(
        active ? music.volume : 0,
        now + fadeSeconds,
      );
      if (!active && music.source && music.fadeTimer === undefined)
        music.fadeTimer = window.setTimeout((): void => {
          music.fadeTimer = undefined;
          if (selectedMusic() !== name) stopTrack(music);
        }, 1100);
    }
  };
  const beginGameplayMusic = (): void => {
    if (!sound.playing) return;
    const now = context.currentTime;
    sound.musicDucked = false;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicLevel(false), now);
    sound.musicScene = "game";
    syncPlayback(0);
  };
  loadTrack(musicTracks[menuTracks[menuTrack]]);
  document.addEventListener(
    "visibilitychange",
    (): void => {
      if (document.hidden) {
        stopMusic();
        for (const source of voices) source.stop();
        void context.suspend();
      } else if (sound.musicScene !== "off" && sound.enabled) {
        void context
          .resume()
          .then((): void => syncPlayback())
          .catch((error: Error): void =>
            console.warn("Audio could not resume", error.message),
          );
      }
    },
    { signal: loading.signal },
  );
  return {
    context,
    setEnabled: (enabled): void => {
      sound.enabled = enabled;
      master.gain.setTargetAtTime(
        enabled ? 0.56 : 0,
        context.currentTime,
        0.04,
      );
      syncPlayback();
    },
    setMusicEnabled: (enabled): void => {
      sound.music = enabled;
      syncPlayback();
    },
    setVolume: (kind, volume): void => {
      const level = Math.max(0, Math.min(1, volume));
      if (kind === "music") {
        sound.musicVolume = level;
        musicGain.gain.setTargetAtTime(musicLevel(), context.currentTime, 0.04);
      } else
        effects.gain.setTargetAtTime(level * 0.85, context.currentTime, 0.04);
    },
    setMenu: (): void => {
      sound.playing = false;
      sound.musicScene = "menu";
      sound.musicDucked = false;
      syncPlayback();
    },
    startGameplayMusic: (): void => {
      beginGameplayMusic();
    },
    setPlaying: (playing): void => {
      sound.playing = playing;
      sound.musicScene = "off";
      if (playing) gameTrack = 0;
      if (playing) {
        const now = context.currentTime;
        for (const music of Object.values(musicTracks)) {
          music.gain.gain.cancelScheduledValues(now);
          music.gain.gain.setValueAtTime(music.gain.gain.value, now);
          music.gain.gain.linearRampToValueAtTime(0, now + 0.7);
          if (music.source && music.fadeTimer === undefined)
            music.fadeTimer = window.setTimeout((): void => {
              music.fadeTimer = undefined;
              if (sound.musicScene === "off") stopTrack(music);
            }, 800);
        }
      } else {
        for (const source of voices) source.stop();
        setMusicDuck(false);
        stopMusic();
      }
    },
    click: (): void => {
      if (
        document.hidden ||
        !sound.enabled ||
        sound.disposed ||
        context.state !== "running" ||
        voices.size >= 10
      )
        return;
      const buffer = buffers.get("click-0");
      if (!buffer) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = 8;
      source.connect(gain);
      gain.connect(effects);
      voices.add(source);
      source.onended = (): void => {
        voices.delete(source);
        source.disconnect();
        gain.disconnect();
      };
      source.start();
    },
    play: (cue): void => {
      if (
        document.hidden ||
        !sound.enabled ||
        !sound.playing ||
        sound.disposed ||
        context.state !== "running" ||
        voices.size >= 10
      )
        return;
      if (cue.kind === "countdown") {
        if (sound.musicScene === "off" && cue.strength >= 2 / 3)
          beginGameplayMusic();
        if (sound.musicScene === "game") setMusicDuck(true);
      } else if (cue.kind === "go") {
        setMusicDuck(false, 0.68);
      } else if (cue.kind === "goal") {
        setMusicDuck(true);
        setMusicDuck(false, 2);
      }
      const buffer = buffers.get(
        cue.kind === "dive" || cue.kind === "surface"
          ? cue.kind
          : `${cue.kind}-${
              cue.kind === "goal"
                ? 1
                : cue.kind === "countdown"
                  ? 0
                  : sound.variation++ % 3
            }`,
      );
      if (!buffer) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      const pan = context.createStereoPanner();
      source.buffer = buffer;
      const splash = cue.kind === "dive" || cue.kind === "surface";
      source.playbackRate.value = splash
        ? cue.kind === "dive"
          ? 0.95
          : 1.1
        : 1;
      gain.gain.value =
        cue.gain *
        (0.45 + cue.strength * 0.55) *
        (splash
          ? 0.85
          : cue.kind === "shot"
            ? 0.9
            : cue.kind === "countdown" || cue.kind === "go"
              ? 0.96
              : cue.kind === "goal"
                ? 0.94
                : 0.65);
      pan.pan.value = cue.pan;
      source.connect(gain);
      gain.connect(pan);
      pan.connect(effects);
      voices.add(source);
      source.onended = (): void => {
        voices.delete(source);
        source.disconnect();
        gain.disconnect();
        pan.disconnect();
      };
      source.start();
    },
    dispose: (): void => {
      sound.disposed = true;
      loading.abort();
      stopMusic();
      for (const music of Object.values(musicTracks)) {
        if (music.fadeTimer !== undefined) window.clearTimeout(music.fadeTimer);
        music.buffer = undefined;
        music.gain.disconnect();
      }
      musicGain.disconnect();
      for (const source of voices) source.stop();
      voices.clear();
      buffers.clear();
      void context.close();
    },
  };
};
