const express = require("express");
const path = require("path");
const fs = require("fs");
const { mixSfxIntoVideo } = require("../services/ffmpegService");

const router = express.Router();

const UPLOADS_DIR    = path.join(__dirname, "../uploads");
const OUTPUTS_DIR    = path.join(__dirname, "../outputs");

/**
 * POST /api/export
 * Body: { videoId, sfxEvents?, bgmDecision?, enableSfx, enableBgm }
 */
router.post("/export", async (req, res) => {
  const {
    videoId,
    sfxEvents,
    bgmDecision,
    enableSfx = true,
    enableBgm = true,
  } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: "videoId is required" });
  }

  // Find uploaded video
  const registryPath = path.join(UPLOADS_DIR, "registry.json");
  if (!fs.existsSync(registryPath)) {
    return res.status(404).json({ error: "No uploads registry found" });
  }
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const entry = registry[videoId];
  if (!entry) {
    return res.status(404).json({ error: `Video ${videoId} not found` });
  }

  const inputVideo = entry.filePath;
  if (!fs.existsSync(inputVideo)) {
    return res.status(404).json({ error: "Video file not found on disk" });
  }

  // Load SFX events
  let events = sfxEvents;
  let bgm    = bgmDecision;

  if (!events || !bgm) {
    const sfxPath = path.join(OUTPUTS_DIR, `sfx_decision_${videoId}.json`);
    if (!fs.existsSync(sfxPath)) {
      return res.status(400).json({
        error: "No SFX/BGM decision found. Run POST /api/sfx-analyze first.",
      });
    }
    const sfxData = JSON.parse(fs.readFileSync(sfxPath, "utf8"));
    if (!events) events = sfxData.events || [];
    if (!bgm)    bgm    = sfxData.bgm    || null;

    // Use stored duration
    var storedDuration = sfxData.duration || 0;
  }

  const outputFilename = `sfx_output_${videoId}_${Date.now()}.mp4`;
  const outputPath     = path.join(OUTPUTS_DIR, outputFilename);

  const finalEvents = enableSfx ? events : [];
  const finalBgm    = enableBgm ? bgm    : null;
  const duration    = storedDuration || 0;

  try {
    console.log(`[export] Starting: SFX=${enableSfx} (${finalEvents.length} events), BGM=${enableBgm && !!finalBgm}`);

    if (finalEvents.length > 0 || finalBgm) {
      await mixSfxIntoVideo(inputVideo, finalEvents, outputPath, finalBgm, duration);
    } else {
      fs.copyFileSync(inputVideo, outputPath);
    }

    const stats = fs.statSync(outputPath);

    res.json({
      success: true,
      videoId,
      outputFilename,
      outputUrl:    `/outputs/${outputFilename}`,
      downloadUrl:  `/outputs/${outputFilename}`,
      sfxEventsApplied: finalEvents.length,
      bgmTrack:     finalBgm ? finalBgm.track_id : null,
      fileSizeMB:   (stats.size / 1024 / 1024).toFixed(2),
    });
  } catch (err) {
    console.error("[export] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/outputs
 */
router.get("/outputs", (req, res) => {
  const files = fs.readdirSync(OUTPUTS_DIR)
    .filter((f) => f.endsWith(".mp4") || f.endsWith(".json"))
    .map((f) => ({
      filename:  f,
      url:       `/outputs/${f}`,
      sizeKB:    Math.round(fs.statSync(path.join(OUTPUTS_DIR, f)).size / 1024),
      createdAt: fs.statSync(path.join(OUTPUTS_DIR, f)).mtime.toISOString(),
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ files });
});

module.exports = router;