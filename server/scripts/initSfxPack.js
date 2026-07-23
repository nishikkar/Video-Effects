/**
 * initSfxPack.js
 *
 * Creates silent placeholder .wav files for development/testing.
 * In production, replace these with real SFX files.
 *
 * Run: node scripts/initSfxPack.js
 */

const fs = require("fs");
const path = require("path");

const SFX_DIR = path.join(__dirname, "../assets/sfx");
fs.mkdirSync(SFX_DIR, { recursive: true });

// Minimal valid WAV file header for a 0.5s silent mono 44100Hz 16-bit PCM file
function makeSilentWav(durationSec = 0.5) {
  const sampleRate = 44100;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const fileSize = 36 + dataSize;

  const buf = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buf.write("RIFF", offset); offset += 4;
  buf.writeUInt32LE(fileSize, offset); offset += 4;
  buf.write("WAVE", offset); offset += 4;

  // fmt chunk
  buf.write("fmt ", offset); offset += 4;
  buf.writeUInt32LE(16, offset); offset += 4; // chunk size
  buf.writeUInt16LE(1, offset); offset += 2;  // PCM
  buf.writeUInt16LE(numChannels, offset); offset += 2;
  buf.writeUInt32LE(sampleRate, offset); offset += 4;
  buf.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), offset); offset += 4;
  buf.writeUInt16LE(numChannels * (bitsPerSample / 8), offset); offset += 2;
  buf.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk
  buf.write("data", offset); offset += 4;
  buf.writeUInt32LE(dataSize, offset); offset += 4;
  // Remaining bytes are zero (silence)

  return buf;
}

const SFX_FILES = [
  { name: "question_ping.wav", duration: 0.8 },
  { name: "impact_soft.wav", duration: 0.5 },
  { name: "tension_rise.wav", duration: 2.0 },
  { name: "transition_whoosh.wav", duration: 1.0 },
  { name: "pause_click.wav", duration: 0.3 },
];

console.log("🎵 Initializing SFX pack...\n");

for (const sfx of SFX_FILES) {
  const filePath = path.join(SFX_DIR, sfx.name);
  if (fs.existsSync(filePath)) {
    console.log(`  ✓ Already exists: ${sfx.name}`);
  } else {
    const wavData = makeSilentWav(sfx.duration);
    fs.writeFileSync(filePath, wavData);
    console.log(`  ✓ Created placeholder: ${sfx.name} (${sfx.duration}s silent)`);
  }
}

console.log(`
✅ SFX pack ready at: ${SFX_DIR}

⚠️  These are SILENT placeholders for development.
   Replace them with real .wav files for actual SFX output.

   Expected files:
${SFX_FILES.map((f) => `   - ${f.name}`).join("\n")}
`);
