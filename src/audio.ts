import { assetUrl } from "./asset-url";
import { createEffectBuffers } from "./audio-effects";
import type { AudioCue } from "./audio-events";

export type PoolAudio = {
  context: AudioContext;
  setEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setVolume: (kind: "music" | "effects", volume: number) => void;
  setPlaying: (playing: boolean) => void;
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
  musicGain.connect(context.destination);
  const musicState: {
    buffer?: AudioBuffer;
    source?: AudioBufferSourceNode;
    offset: number;
    started: number;
    loading: boolean;
  } = { offset: 0, started: 0, loading: false };
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
  };
  for (const kind of ["dive", "surface"] as const) {
    fetch(assetUrl(`/audio/${kind}.wav`), { signal: loading.signal })
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
          console.warn("Splash could not load", error.message);
      });
  }
  const stopMusic = (): void => {
    const source = musicState.source;
    if (!source) return;
    musicState.offset =
      (musicState.offset + context.currentTime - musicState.started) %
      (musicState.buffer?.duration ?? 1);
    musicState.source = undefined;
    source.stop();
    source.disconnect();
  };
  const syncPlayback = (): void => {
    if (sound.disposed) return;
    const wanted =
      sound.enabled && sound.music && sound.playing && !document.hidden;
    if (!wanted) {
      stopMusic();
      return;
    }
    if (musicState.source) return;
    if (!musicState.buffer) {
      if (musicState.loading) return;
      musicState.loading = true;
      void fetch(assetUrl("/audio/electric-stream.m4a"), {
        signal: loading.signal,
      })
        .then((response): Promise<ArrayBuffer> => {
          if (!response.ok) throw new Error(`Music: ${response.status}`);
          return response.arrayBuffer();
        })
        .then((data): Promise<AudioBuffer> => context.decodeAudioData(data))
        .then((buffer): void => {
          if (sound.disposed) return;
          musicState.buffer = buffer;
          musicState.loading = false;
          syncPlayback();
        })
        .catch((error: Error): void => {
          musicState.loading = false;
          if (!sound.disposed)
            console.warn("Music could not load", error.message);
        });
      return;
    }
    const source = context.createBufferSource();
    source.buffer = musicState.buffer;
    source.loop = true;
    source.playbackRate.value = 1;
    source.connect(musicGain);
    musicState.started = context.currentTime;
    musicState.source = source;
    source.start(0, musicState.offset);
  };
  document.addEventListener(
    "visibilitychange",
    (): void => {
      if (document.hidden) {
        stopMusic();
        for (const source of voices) source.stop();
        void context.suspend();
      } else if (sound.playing && sound.enabled) {
        void context
          .resume()
          .then(syncPlayback)
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
        musicGain.gain.setTargetAtTime(
          level * 0.42 * 0.56,
          context.currentTime,
          0.04,
        );
      } else
        effects.gain.setTargetAtTime(level * 0.85, context.currentTime, 0.04);
    },
    setPlaying: (playing): void => {
      sound.playing = playing;
      if (!playing) for (const source of voices) source.stop();
      syncPlayback();
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
      const buffer = buffers.get(
        cue.kind === "dive" || cue.kind === "surface"
          ? cue.kind
          : `${cue.kind}-${sound.variation++ % 3}`,
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
        (splash ? 0.85 : cue.kind === "shot" ? 0.9 : 0.65);
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
      musicState.buffer = undefined;
      musicGain.disconnect();
      for (const source of voices) source.stop();
      voices.clear();
      buffers.clear();
      void context.close();
    },
  };
};
