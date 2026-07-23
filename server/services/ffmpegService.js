/**
 * ffmpegService.js
 *
 * Mixes SFX events + background music into a video file.
 * Supports .wav and .mp3 for both SFX and BGM.
 *
 * Audio chain:
 *   [original audio] + [sfx1..N delayed+volume] + [bgm looped+faded+ducked]
 *   → amix → aac output
 */

const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const path = require("path");
const fs = require("fs");
const { buildBgmFilter } = require("./musicService");
const { AVAILABLE_BGM } = require("./promptBuilder");

ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || ffmpegStatic);

const SFX_ASSETS_DIR = path.join(__dirname, "../assets/sfx");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves SFX file — checks exact filename then tries .wav/.mp3 fallback.
 */
function resolveSfxFile(assetFile) {
  if (!assetFile) return null;
  const exact = path.join(SFX_ASSETS_DIR, assetFile);
  if (fs.existsSync(exact)) return exact;
  const base = path.join(SFX_ASSETS_DIR, path.basename(assetFile, path.extname(assetFile)));
  for (const ext of [".wav", ".mp3"]) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Mixes SFX events and optional BGM into a video file.
 *
 * @param {string} inputVideo   - path to source video
 * @param {Array}  sfxEvents    - array of SFX event objects from AI
 * @param {string} outputPath   - path to write output mp4
 * @param {Object} bgmDecision  - AI bgm object (null if no BGM)
 * @param {number} videoDuration - video duration in seconds
 */
async function mixSfxIntoVideo(inputVideo, sfxEvents, outputPath, bgmDecision = null, videoDuration = 0) {
  return new Promise((resolve, reject) => {

    // ── Resolve valid SFX events ────────────────────────────────────────────
    const validSfx = sfxEvents
      .map((e) => {
        const filePath = resolveSfxFile(e.asset?.file || `${e.sfx_type}.wav`);
        if (!filePath) {
          console.warn(`[ffmpeg] SFX not found, skipping: ${e.asset?.file || e.sfx_type}`);
          return null;
        }
        return { ...e, resolvedPath: filePath };
      })
      .filter(Boolean);

    // ── Resolve BGM ─────────────────────────────────────────────────────────
    let bgmAsset = null;
    let bgmFilterResult = null;

    if (bgmDecision && bgmDecision.track_id) {
      bgmAsset = AVAILABLE_BGM.find((b) => b.id === bgmDecision.track_id);
      if (bgmAsset) {
        bgmFilterResult = buildBgmFilter(
          bgmDecision,
          bgmAsset,
          videoDuration,
          `[BGM_INPUT]`, // placeholder — replaced below with actual index
          `[bgm_out]`
        );
        if (!bgmFilterResult) {
          console.warn(`[ffmpeg] BGM file not found for track: ${bgmDecision.track_id}`);
          bgmAsset = null;
        }
      } else {
        console.warn(`[ffmpeg] Unknown BGM track id: ${bgmDecision.track_id}`);
      }
    }

    const hasSfx = validSfx.length > 0;
    const hasBgm = bgmAsset && bgmFilterResult;

    // If nothing to mix, just copy
    if (!hasSfx && !hasBgm) {
      console.log("[ffmpeg] No SFX or BGM — copying video as-is");
      fs.copyFileSync(inputVideo, outputPath);
      return resolve(outputPath);
    }

    console.log(`[ffmpeg] Mixing: ${validSfx.length} SFX events, BGM: ${hasBgm ? bgmDecision.track_id : "none"}`);

    // ── Build FFmpeg command ─────────────────────────────────────────────────
    const cmd = ffmpeg();

    // Input 0: original video
    cmd.input(inputVideo);

    // Inputs 1..N: SFX files
    for (const sfx of validSfx) {
      cmd.input(sfx.resolvedPath);
    }

    // Input N+1: BGM file (if any)
    const bgmInputIndex = hasBgm ? validSfx.length + 1 : null;
    if (hasBgm) {
      cmd.input(bgmFilterResult.resolvedPath);
    }

    // ── Build filter_complex ─────────────────────────────────────────────────
    let filterComplex = "";
    const mixLabels = ["[0:a]"]; // start with original audio

    // SFX: each delayed + volume adjusted
    validSfx.forEach((sfx, i) => {
      const delayMs = Math.round(sfx.timestamp * 1000);
      const vol = Math.min(0.9, Math.max(0.3, parseFloat(sfx.volume) || 0.65)).toFixed(2);
      const label = `[sfx${i}]`;
      filterComplex += `[${i + 1}:a]adelay=${delayMs}|${delayMs},volume=${vol}${label};`;
      mixLabels.push(label);
    });

    // BGM: loop + trim + fade + duck
    if (hasBgm) {
      // Replace placeholder with actual input index
      const bgmFilter = bgmFilterResult.filterStr.replace("[BGM_INPUT]", `[${bgmInputIndex}:a]`);
      filterComplex += `${bgmFilter};`;
      mixLabels.push("[bgm_out]");
    }

    // amix: combine all audio streams
    const totalInputs = mixLabels.length;
    filterComplex += `${mixLabels.join("")}amix=inputs=${totalInputs}:duration=first:dropout_transition=0:normalize=0[aout]`;

    cmd
      .complexFilter(filterComplex)
      .outputOptions([
        "-map 0:v",
        "-map [aout]",
        "-c:v copy",
        "-c:a aac",
        "-b:a 192k",
      ])
      .output(outputPath)
      .on("start", (cmdLine) => {
        console.log("[ffmpeg] Starting:", cmdLine.slice(0, 160) + "...");
      })
      .on("progress", (p) => {
        if (p.percent) process.stdout.write(`\r[ffmpeg] Progress: ${Math.round(p.percent)}%   `);
      })
      .on("end", () => {
        console.log(`\n[ffmpeg] ✓ Done: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err, stdout, stderr) => {
        console.error("\n[ffmpeg] Error:", err.message);
        if (stderr) console.error("[ffmpeg] stderr:", stderr.slice(-1000));
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .run();
  });
}

module.exports = { mixSfxIntoVideo };