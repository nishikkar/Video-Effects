const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const TRANSCRIPTS_DIR = path.join(__dirname, "../transcripts");

/**
 * GET /api/transcript/:videoId
 * Returns transcript JSON if ready, or { status: "pending" } if still processing,
 * or { status: "error", message } if transcription failed.
 */
router.get("/transcript/:videoId", (req, res) => {
  const { videoId } = req.params;
  const transcriptPath = path.join(TRANSCRIPTS_DIR, `${videoId}.json`);
  const errorPath = path.join(TRANSCRIPTS_DIR, `${videoId}.error`);
  const pendingPath = path.join(TRANSCRIPTS_DIR, `${videoId}.pending`);

  if (fs.existsSync(transcriptPath)) {
    try {
      const transcript = JSON.parse(fs.readFileSync(transcriptPath, "utf8"));
      return res.json({ status: "ready", transcript });
    } catch (e) {
      return res.status(500).json({ status: "error", message: "Transcript file is malformed" });
    }
  }

  if (fs.existsSync(errorPath)) {
    const errMsg = fs.readFileSync(errorPath, "utf8");
    return res.json({ status: "error", message: errMsg });
  }

  if (fs.existsSync(pendingPath)) {
    return res.json({ status: "pending", message: "Transcription in progress..." });
  }

  return res.json({ status: "pending", message: "Transcription queued..." });
});

/**
 * GET /api/transcript/:videoId/text
 * Returns plain readable transcript text (concatenated words).
 */
router.get("/transcript/:videoId/text", (req, res) => {
  const { videoId } = req.params;
  const transcriptPath = path.join(TRANSCRIPTS_DIR, `${videoId}.json`);

  if (!fs.existsSync(transcriptPath)) {
    return res.status(404).json({ error: "Transcript not found or not ready yet" });
  }

  const transcript = JSON.parse(fs.readFileSync(transcriptPath, "utf8"));
  const text = transcript.words.map((w) => w.word).join(" ");
  res.json({ text, wordCount: transcript.words.length, duration: transcript.clip_end });
});

module.exports = router;
