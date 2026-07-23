/**
 * sfxDecisionService.js
 *
 * AI-powered SFX + BGM decision engine.
 * Sends transcript to AI, gets back SFX events + BGM selection,
 * validates both, and returns a clean result object.
 */

const { callAI, parseAIResponse } = require("./aiService");
const { buildPrompt, AVAILABLE_SFX, AVAILABLE_BGM, SYSTEM_PROMPT } = require("./promptBuilder");

const VALID_SFX_IDS = new Set(AVAILABLE_SFX.map((s) => s.id));
const VALID_BGM_IDS = new Set(AVAILABLE_BGM.map((b) => b.id));

// ─── Validate SFX Events ──────────────────────────────────────────────────────
function validateEvents(rawEvents, clipDuration) {
  if (!Array.isArray(rawEvents)) return [];

  const validated = [];
  const usedTimestamps = [];

  for (const evt of rawEvents) {
    if (!evt.sfx_type || evt.timestamp === undefined) continue;

    if (!VALID_SFX_IDS.has(evt.sfx_type)) {
      console.warn(`[sfx] Unknown SFX type "${evt.sfx_type}" — skipping`);
      continue;
    }

    const ts = parseFloat(evt.timestamp);
    if (isNaN(ts) || ts < 0 || ts > clipDuration) {
      console.warn(`[sfx] Timestamp ${ts} out of range — skipping`);
      continue;
    }

    const tooClose = usedTimestamps.some((used) => Math.abs(used - ts) < 3.0);
    if (tooClose) {
      console.warn(`[sfx] Event at ${ts}s too close to another — skipping`);
      continue;
    }

    const asset = AVAILABLE_SFX.find((s) => s.id === evt.sfx_type);

    validated.push({
      id: evt.id || `sfx_${validated.length + 1}`,
      sfx_type: evt.sfx_type,
      timestamp: parseFloat(ts.toFixed(3)),
      volume: Math.min(0.9, Math.max(0.4, parseFloat(evt.volume) || 0.65)),
      reasoning: evt.reasoning || "",
      confidence: Math.min(1, Math.max(0, parseFloat(evt.confidence) || 0.7)),
      emotional_tag: evt.emotional_tag || "",
      asset,
    });

    usedTimestamps.push(ts);
  }

  return validated.sort((a, b) => a.timestamp - b.timestamp);
}

// ─── Validate BGM Decision ────────────────────────────────────────────────────
function validateBgm(rawBgm) {
  if (!rawBgm || !rawBgm.track_id) return null;

  if (!VALID_BGM_IDS.has(rawBgm.track_id)) {
    console.warn(`[sfx] Unknown BGM track "${rawBgm.track_id}" — skipping BGM`);
    return null;
  }

  const asset = AVAILABLE_BGM.find((b) => b.id === rawBgm.track_id);

  const duckPoints = Array.isArray(rawBgm.duck_points)
    ? rawBgm.duck_points
        .filter((dp) => dp.timestamp !== undefined)
        .map((dp) => ({
          timestamp:   Math.max(0, parseFloat(dp.timestamp) || 0),
          duration:    Math.max(0.5, parseFloat(dp.duration) || 2.0),
          duck_volume: Math.min(0.12, Math.max(0.02, parseFloat(dp.duck_volume) || 0.06)),
          reason:      dp.reason || "",
        }))
    : [];

  return {
    track_id:          rawBgm.track_id,
    base_volume:       Math.min(0.22, Math.max(0.08, parseFloat(rawBgm.base_volume) || 0.15)),
    fade_in_duration:  Math.max(0.5, parseFloat(rawBgm.fade_in_duration) || 2.0),
    fade_out_duration: Math.max(0.5, parseFloat(rawBgm.fade_out_duration) || 3.0),
    reasoning:         rawBgm.reasoning || "",
    duck_points:       duckPoints,
    asset,
  };
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function buildStats(events) {
  const byType = {};
  for (const e of events) {
    byType[e.sfx_type] = (byType[e.sfx_type] || 0) + 1;
  }
  return { total: events.length, byType };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function analyzeSfx(transcript) {
  const { video_id, clip_end, words } = transcript;

  if (!words || words.length === 0) {
    return {
      video_id,
      duration: clip_end,
      events: [],
      bgm: null,
      video_analysis: null,
      stats: { total: 0, byType: {} },
      assets: Object.fromEntries(AVAILABLE_SFX.map((s) => [s.id, s])),
      bgm_assets: Object.fromEntries(AVAILABLE_BGM.map((b) => [b.id, b])),
      generatedAt: new Date().toISOString(),
    };
  }

  console.log(`[sfx] Analyzing: ${words.length} words, ${clip_end.toFixed(1)}s`);

  const userPrompt = buildPrompt(transcript);
  console.log(`[sfx] Sending to AI...`);
  const rawResponse = await callAI(SYSTEM_PROMPT, userPrompt);
  console.log(`[sfx] AI responded (${rawResponse.length} chars)`);

  const parsed = parseAIResponse(rawResponse);

  const events      = validateEvents(parsed.events || [], clip_end);
  const bgm         = validateBgm(parsed.bgm);
  const video_analysis = parsed.video_analysis || null;

  console.log(`[sfx] ✓ ${events.length} SFX events, BGM: ${bgm ? bgm.track_id : "none"}`);
  if (video_analysis) {
    console.log(`[sfx] Tone: ${video_analysis.tone} | ${video_analysis.purpose}`);
  }

  return {
    video_id,
    duration: clip_end,
    events,
    bgm,
    video_analysis,
    stats: buildStats(events),
    assets:     Object.fromEntries(AVAILABLE_SFX.map((s) => [s.id, s])),
    bgm_assets: Object.fromEntries(AVAILABLE_BGM.map((b) => [b.id, b])),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { analyzeSfx, AVAILABLE_SFX, AVAILABLE_BGM };