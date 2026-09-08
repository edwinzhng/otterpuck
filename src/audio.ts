import { createEffectBuffers } from "./audio-effects";
import type { AudioCue } from "./audio-events";

export type PoolAudio = {
  context: AudioContext;
  setEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setPlaying: (playing: boolean) => void;
  play: (cue: AudioCue) => void;
  dispose: () => void;
};

export const createAudio = (): PoolAudio => {
  const context = new AudioContext();
  const master = context.createGain();
  const music = context.createGain();
  const effects = context.createGain();
  const limiter = context.createDynamicsCompressor();
  master.gain.value = 0;
  music.gain.value = 0.42;
  effects.gain.value = 0.85;
  limiter.threshold.value = -5;
  limiter.knee.value = 4;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  music.connect(master);
  effects.connect(master);
  master.connect(limiter);
  limiter.connect(context.destination);
  const track = document.createElement("audio");
  track.id = "game-music";
  track.src = "/audio/electric-stream.m4a";
  track.loop = true;
  track.preload = "none";
  track.hidden = true;
  track.dataset.state = "idle";
  document.body.append(track);
  const stream = context.createMediaElementSource(track);
  stream.connect(music);
  const buffers = createEffectBuffers(context);
  const loading = new AbortController();
  const voices = new Set<AudioBufferSourceNode>();
  const sound = {
    enabled: false,
    music: true,
    playing: false,
    disposed: false,
    requested: false,
    variation: 0,
  };
  track.addEventListener("playing", (): void => {
    track.dataset.state = "playing";
  });
  track.addEventListener("pause", (): void => {
    track.dataset.state = "paused";
  });
  track.addEventListener("timeupdate", (): void => {
    track.dataset.seconds = track.currentTime.toFixed(2);
  });
  track.addEventListener("error", (): void => {
    track.dataset.state = "error";
    console.warn("Music could not load", track.error?.message);
  });
  for (const kind of ["dive", "surface"] as const) {
    fetch(`/audio/${kind}.wav`, { signal: loading.signal })
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
  const syncPlayback = (): void => {
    if (sound.disposed) return;
    const wanted = sound.enabled && sound.music && sound.playing;
    if (wanted === sound.requested) return;
    sound.requested = wanted;
    if (wanted) {
      track.dataset.state = "loading";
      void track.play().catch((error: Error): void => {
        if (sound.disposed || !sound.requested) return;
        sound.requested = false;
        track.dataset.state = "blocked";
        console.warn("Music playback could not start", error.message);
      });
    } else track.pause();
  };
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
    setPlaying: (playing): void => {
      sound.playing = playing;
      if (!playing) for (const source of voices) source.stop();
      syncPlayback();
    },
    play: (cue): void => {
      if (
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
      if (
        (cue.kind === "shot" || splash || cue.kind === "goal") &&
        cue.gain > 0.4
      ) {
        music.gain.cancelScheduledValues(context.currentTime);
        music.gain.setTargetAtTime(0.27, context.currentTime, 0.02);
        music.gain.setTargetAtTime(0.42, context.currentTime + 0.22, 0.18);
      }
      source.start();
      track.dataset.lastEffect = cue.kind;
    },
    dispose: (): void => {
      sound.disposed = true;
      loading.abort();
      track.pause();
      track.removeAttribute("src");
      track.load();
      track.remove();
      for (const source of voices) source.stop();
      voices.clear();
      stream.disconnect();
      buffers.clear();
      void context.close();
    },
  };
};
