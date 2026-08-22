import { mkdirSync, writeFileSync } from "node:fs";

const sampleRate = 44_100;
const seconds = 32;
const samples = sampleRate * seconds;
const pcm = new Int16Array(samples);
let seed = 0x6c617661;
const random = () => {
  seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
  return seed / 0x1_0000_0000;
};

let low = 0;
const cracks = Array.from({ length: 55 }, () => Math.floor(random() * samples));
for (let index = 0; index < samples; index += 1) {
  const white = random() * 2 - 1;
  low = low * 0.985 + white * 0.015;
  let value = low * 0.20;
  for (const crack of cracks) {
    const distance = index - crack;
    if (distance >= 0 && distance < sampleRate * 0.09) {
      value += (random() * 2 - 1) * 0.58 * Math.exp(-distance / (sampleRate * 0.018));
    }
  }
  pcm[index] = Math.max(-1, Math.min(1, value)) * 32767;
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.byteLength, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.byteLength, 40);

mkdirSync(new URL("../public/audio/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/audio/campfire.wav", import.meta.url), Buffer.concat([header, Buffer.from(pcm.buffer)]));
