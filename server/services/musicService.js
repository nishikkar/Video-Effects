/**
 * musicService.js
 *
 * Handles background music logic:
 * - Resolves the BGM file path
 * - Builds FFmpeg filter instructions for fade-in, fade-out, and duck points
 * - Exported and consumed by ffmpegService.js
 */

const path = require("path");
const fs = require("fs");

const BGM_ASSETS_DIR = path.join(__dirname, "../assets/music");

/**
 * Resolves the actual file path for a BGM track.
 */
function resolveBgmFile(filename) {
  if (!filename) return null;
  const full = path.join(BGM_ASSETS_DIR, filename);
  if (fs.existsSync(full)) return full;
  return null;
}

/**
 * Builds the FFmpeg audio filter string for a BGM track.
 *
 * Applies in order:
 * 1. Loop the track to cover the full video duration
 * 2. Trim to exact video duration
 * 3. Fade in at start
 * 4. Fade out at end
 * 5. Volume duck points (using volume filter with timeline expressions)
 *
 * @param {Object} bgmDecision  - AI bgm object { track_id, base_volume, fade_in_duration, fade_out_duration, duck_points, ... }
 * @param {Object} bgmAsset     - from AVAILABLE_BGM { file, ... }
 * @param {number} videoDuration - total video duration in seconds
 * @param {string} inputLabel   - FFmpeg input label e.g. "[1:a]"
 * @param {string} outputLabel  - FFmpeg output label e.g. "[bgm_out]"
 * @returns {{ filterStr: string, resolvedPath: string } | null}
 */
function buildBgmFilter(bgmDecision, bgmAsset, videoDuration, inputLabel, outputLabel) {
  if (!bgmAsset) return null;

  const resolvedPath = resolveBgmFile(bgmAsset.file);
  if (!resolvedPath) {
    console.warn(`[music] BGM file not found: ${bgmAsset.file}`);
    return null;
  }

  const baseVol = Math.min(0.22, Math.max(0.08, parseFloat(bgmDecision.base_volume) || 0.15));
  const fadeIn  = Math.max(0.5, parseFloat(bgmDecision.fade_in_duration)  || 2.0);
  const fadeOut = Math.max(0.5, parseFloat(bgmDecision.fade_out_duration) || 3.0);
  const duckPoints = Array.isArray(bgmDecision.duck_points) ? bgmDecision.duck_points : [];

  // Build a volume timeline expression for ducking
  // FFmpeg volume filter supports enable= and volume= with timeline editing
  // We'll chain multiple volume filters — one per duck point — then a final base volume
  let filterChain = `${inputLabel}`;

  // Step 1: loop + trim to video duration
  filterChain += `aloop=loop=-1:size=2e+09,atrim=duration=${videoDuration.toFixed(3)},asetpts=PTS-STARTPTS`;

  // Step 2: base volume
  filterChain += `,volume=${baseVol.toFixed(3)}`;

  // Step 3: fade in
  filterChain += `,afade=t=in:st=0:d=${fadeIn.toFixed(2)}`;

  // Step 4: fade out
  const fadeOutStart = Math.max(0, videoDuration - fadeOut);
  filterChain += `,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut.toFixed(2)}`;

  // Step 5: duck points — each adds a volume reduction for a time window
  for (const dp of duckPoints) {
    const ts  = Math.max(0, parseFloat(dp.timestamp) || 0);
    const dur = Math.max(0.5, parseFloat(dp.duration) || 2.0);
    const duckVol = Math.min(0.12, Math.max(0.02, parseFloat(dp.duck_volume) || 0.06));
    const end = Math.min(videoDuration, ts + dur);
    // Use volume filter with enable expression for time-gated ducking
    filterChain += `,volume=enable='between(t,${ts.toFixed(3)},${end.toFixed(3)})':volume=${duckVol.toFixed(3)}`;
  }

  filterChain += `${outputLabel}`;

  return { filterStr: filterChain, resolvedPath };
}

module.exports = { resolveBgmFile, buildBgmFilter, BGM_ASSETS_DIR };