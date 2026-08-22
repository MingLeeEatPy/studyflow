import type { ExecutionSettings } from "./executionTypes";

export const AMBIENT_SOUNDS = {
  off: { label: "关闭", src: null },
  forest: { label: "林间", src: "/audio/forest.ogg" },
  stream: { label: "溪流", src: "/audio/stream.ogg" },
  campfire: { label: "篝火", src: "/audio/campfire.wav" },
} as const;

export const COMPLETION_SOUNDS = {
  "wind-chime": { label: "清透风铃", src: "/audio/wind-chime.ogg", durationSeconds: 5 },
  "forest-birds": { label: "林间鸟鸣", src: "/audio/forest-birds.ogg", durationSeconds: 5 },
  "stream-flute": { label: "溪流短笛尾音", src: "/audio/stream-flute.ogg", durationSeconds: 4 },
  "campfire-bell": { label: "木柴爆裂与温暖低音钟", src: "/audio/campfire.wav", durationSeconds: 2 },
} as const;

export type AmbientSound = keyof typeof AMBIENT_SOUNDS;
export type CompletionSound = keyof typeof COMPLETION_SOUNDS;

export function resolveCompletionSound(
  selection: ExecutionSettings["completionSound"],
  ambientSound: ExecutionSettings["ambientSound"],
): CompletionSound {
  if (selection !== "follow-ambience") return selection;
  if (ambientSound === "forest") return "forest-birds";
  if (ambientSound === "stream") return "stream-flute";
  if (ambientSound === "campfire") return "campfire-bell";
  return "wind-chime";
}

function playClip(src: string, volume: number, durationSeconds: number, delayMs = 0): void {
  if (typeof Audio === "undefined") return;
  const start = () => {
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, volume / 100));
    const stop = () => {
      audio.pause();
      audio.currentTime = 0;
    };
    audio.addEventListener("ended", stop, { once: true });
    window.setTimeout(stop, durationSeconds * 1000);
    void audio.play().catch(() => stop());
  };
  if (delayMs > 0) window.setTimeout(start, delayMs); else start();
}

export function previewAmbientSound(sound: AmbientSound, volume: number): void {
  const src = AMBIENT_SOUNDS[sound].src;
  if (src) playClip(src, volume, 8);
}

export function playCompletionSound(settings: Pick<ExecutionSettings, "completionSound" | "ambientSound" | "soundVolume">): void {
  const sound = resolveCompletionSound(settings.completionSound, settings.ambientSound);
  const choice = COMPLETION_SOUNDS[sound];
  playClip(choice.src, settings.soundVolume, choice.durationSeconds);
  if (sound === "campfire-bell") playClip("/audio/warm-gong.ogg", settings.soundVolume, 5, 380);
}
