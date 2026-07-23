const express = require("express");
const path = require("path");
const fs = require("fs");
const { analyzeSfx } = require("../services/sfxDecisionService");
const { AVAILABLE_SFX, AVAILABLE_BGM } = require("../services/promptBuilder");

const router = express.Router();

const TRANSCRIPTS_DIR = path.join(__dirname, "../transcripts");
const OUTPUTS_DIR = path.join(__dirname, "../outputs");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_SFX_IDS = new Set(AVAILABLE_SFX.map((s) => s.id));
const VALID_BGM_IDS = new Set(AVAILABLE_BGM.map((b) => b.id));

function loadDecision(videoId) {
  const outPath = path.join(OUTPUTS_DIR, `sfx_decision_${videoId}.json`);
  if (!fs.existsSync(outPath)) return null;
  return JSON.parse(fs.readFileSync(outPath, "utf8"));
}

function saveDecision(videoId, data) {
  const outPath = path.join(OUTPUTS_DIR, `sfx_decision_${videoId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
}

function clampVolume(v) {
  return Math.min(0.9, Math.max(0.4, parseFloat(v) || 0.65));
}

/** Check that no other event (excluding self by id) is within 3s of ts */
function tooClose(events, ts, excludeId = null) {
  return events.some(
    (e) => e.id !== excludeId && Math.abs(e.timestamp - ts) < 3.0
  );
}

// ─── POST /api/sfx-analyze ────────────────────────────────────────────────────
/**
 * Body: { videoId }
 * Reads transcript, runs AI-powered SFX decision engine, returns SFX events JSON.
 */
router.post("/sfx-analyze", async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: "videoId is required" });
  }

  const transcriptPath = path.join(TRANSCRIPTS_DIR, `${videoId}.json`);
  if (!fs.existsSync(transcriptPath)) {
    return res.status(404).json({ error: "Transcript not found. Run transcription first." });
  }

  try {
    const transcript = JSON.parse(fs.readFileSync(transcriptPath, "utf8"));

    console.log(`[sfx-analyze] Starting AI analysis for ${videoId}...`);
    const sfxEvents = await analyzeSfx(transcript);

    saveDecision(videoId, sfxEvents);

    console.log(`[sfx-analyze] ✓ Done — ${sfxEvents.events.length} events for ${videoId}`);
    res.json(sfxEvents);
  } catch (err) {
    console.error("[sfx-analyze] Error:", err.message);
    res.status(500).json({
      error: err.message,
      hint: err.message.includes("API_KEY")
        ? "Check your .env file has GROQ_API_KEY set correctly"
        : undefined,
    });
  }
});

// ─── GET /api/sfx-analyze/:videoId ───────────────────────────────────────────
/** Returns cached SFX decision JSON if it exists. */
router.get("/sfx-analyze/:videoId", (req, res) => {
  const { videoId } = req.params;
  const data = loadDecision(videoId);

  if (!data) {
    return res.status(404).json({ error: "No SFX analysis found. POST /api/sfx-analyze first." });
  }

  res.json(data);
});

// ─── PATCH /api/sfx-event/:videoId ───────────────────────────────────────────
/**
 * Update a single SFX event's timestamp or volume.
 * Body: { id, timestamp?, volume? }
 */
router.patch("/sfx-event/:videoId", (req, res) => {
  const { videoId } = req.params;
  const { id, sfx_type, timestamp, volume } = req.body;

  if (!id) return res.status(400).json({ error: "event id is required" });

  const data = loadDecision(videoId);
  if (!data) return res.status(404).json({ error: "No SFX analysis found for this videoId." });

  const idx = data.events.findIndex((e) => e.id === id);
  if (idx === -1) return res.status(404).json({ error: `Event "${id}" not found.` });

  const evt = data.events[idx];

  // Apply sfx_type patch
  if (sfx_type !== undefined) {
    if (!VALID_SFX_IDS.has(sfx_type)) {
      return res.status(400).json({ error: `Unknown sfx_type "${sfx_type}". Must be one of: ${[...VALID_SFX_IDS].join(", ")}` });
    }
    evt.sfx_type = sfx_type;
    evt.asset = AVAILABLE_SFX.find((s) => s.id === sfx_type);
  }

  // Apply timestamp patch
  if (timestamp !== undefined) {
    const ts = parseFloat(timestamp);
    if (isNaN(ts) || ts < 0 || ts > data.duration) {
      return res.status(400).json({ error: `Timestamp ${ts} out of range (0 – ${data.duration}s).` });
    }
    if (tooClose(data.events, ts, id)) {
      return res.status(400).json({ error: "Timestamp too close to another event (min 3s gap)." });
    }
    evt.timestamp = parseFloat(ts.toFixed(3));
  }

  // Apply volume patch
  if (volume !== undefined) {
    evt.volume = clampVolume(volume);
  }

  // Rebuild stats after any type change
  const byType = {};
  for (const e of data.events) byType[e.sfx_type] = (byType[e.sfx_type] || 0) + 1;
  data.stats = { total: data.events.length, byType };

  // Re-sort by timestamp
  data.events.sort((a, b) => a.timestamp - b.timestamp);
  saveDecision(videoId, data);

  console.log(`[sfx-event] PATCH ${id} on ${videoId}`);
  res.json({ updated: evt, events: data.events, stats: data.stats });
});

// ─── DELETE /api/sfx-event/:videoId/:eventId ─────────────────────────────────
/** Remove a single SFX event. */
router.delete("/sfx-event/:videoId/:eventId", (req, res) => {
  const { videoId, eventId } = req.params;

  const data = loadDecision(videoId);
  if (!data) return res.status(404).json({ error: "No SFX analysis found for this videoId." });

  const before = data.events.length;
  data.events = data.events.filter((e) => e.id !== eventId);

  if (data.events.length === before) {
    return res.status(404).json({ error: `Event "${eventId}" not found.` });
  }

  // Rebuild stats
  const byType = {};
  for (const e of data.events) byType[e.sfx_type] = (byType[e.sfx_type] || 0) + 1;
  data.stats = { total: data.events.length, byType };

  saveDecision(videoId, data);

  console.log(`[sfx-event] DELETE ${eventId} from ${videoId} — ${data.events.length} remaining`);
  res.json({ removed: eventId, remaining: data.events.length, events: data.events, stats: data.stats });
});

// ─── POST /api/sfx-event/:videoId ────────────────────────────────────────────
/**
 * Add a new user-defined SFX event.
 * Body: { sfx_type, timestamp, volume? }
 */
router.post("/sfx-event/:videoId", (req, res) => {
  const { videoId } = req.params;
  const { sfx_type, timestamp, volume } = req.body;

  if (!sfx_type) return res.status(400).json({ error: "sfx_type is required." });
  if (!VALID_SFX_IDS.has(sfx_type)) {
    return res.status(400).json({ error: `Unknown sfx_type "${sfx_type}". Must be one of: ${[...VALID_SFX_IDS].join(", ")}` });
  }
  if (timestamp === undefined) return res.status(400).json({ error: "timestamp is required." });

  const data = loadDecision(videoId);
  if (!data) return res.status(404).json({ error: "No SFX analysis found for this videoId." });

  const ts = parseFloat(timestamp);
  if (isNaN(ts) || ts < 0 || ts > data.duration) {
    return res.status(400).json({ error: `Timestamp ${ts} out of range (0 – ${data.duration}s).` });
  }
  if (tooClose(data.events, ts)) {
    return res.status(400).json({ error: "Timestamp too close to another event (min 3s gap)." });
  }

  const asset = AVAILABLE_SFX.find((s) => s.id === sfx_type);
  const manualCount = data.events.filter((e) => e.id.startsWith("sfx_manual_")).length;

  const newEvent = {
    id: `sfx_manual_${manualCount + 1}`,
    sfx_type,
    timestamp: parseFloat(ts.toFixed(3)),
    volume: clampVolume(volume ?? 0.65),
    reasoning: "Manually added by user",
    confidence: 1.0,
    emotional_tag: "manual",
    asset,
  };

  data.events.push(newEvent);
  data.events.sort((a, b) => a.timestamp - b.timestamp);

  // Rebuild stats
  const byType = {};
  for (const e of data.events) byType[e.sfx_type] = (byType[e.sfx_type] || 0) + 1;
  data.stats = { total: data.events.length, byType };

  saveDecision(videoId, data);

  console.log(`[sfx-event] POST manual event ${newEvent.id} at ${ts}s for ${videoId}`);
  res.json({ added: newEvent, events: data.events, stats: data.stats });
});

// ─── PATCH /api/sfx-bgm/:videoId ─────────────────────────────────────────────
/**
 * Change the BGM track (and optionally volume/fades).
 * Body: { track_id, base_volume?, fade_in_duration?, fade_out_duration? }
 */
router.patch("/sfx-bgm/:videoId", (req, res) => {
  const { videoId } = req.params;
  const { track_id, base_volume, fade_in_duration, fade_out_duration } = req.body;

  if (!track_id) return res.status(400).json({ error: "track_id is required." });
  if (!VALID_BGM_IDS.has(track_id)) {
    return res.status(400).json({ error: `Unknown track_id "${track_id}". Must be one of: ${[...VALID_BGM_IDS].join(", ")}` });
  }

  const data = loadDecision(videoId);
  if (!data) return res.status(404).json({ error: "No SFX analysis found for this videoId." });

  const asset = AVAILABLE_BGM.find((b) => b.id === track_id);

  // Preserve existing duck_points from previous BGM if present
  const existingDuckPoints = data.bgm?.duck_points || [];

  data.bgm = {
    track_id,
    base_volume: Math.min(0.22, Math.max(0.08, parseFloat(base_volume) || asset.baseVolume || 0.15)),
    fade_in_duration: Math.max(0.5, parseFloat(fade_in_duration) || 2.0),
    fade_out_duration: Math.max(0.5, parseFloat(fade_out_duration) || 3.0),
    reasoning: `Manually changed to "${asset.label}" by user`,
    duck_points: existingDuckPoints,
    asset,
  };

  saveDecision(videoId, data);

  console.log(`[sfx-bgm] PATCH ${videoId} → ${track_id}`);
  res.json({ bgm: data.bgm });
});

module.exports = router;
