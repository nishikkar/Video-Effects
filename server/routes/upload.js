const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { runTranscription } = require("../services/transcriptionService");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp4";
    const videoId = `vid_${uuidv4().slice(0, 8)}`;
    req.videoId = videoId;
    cb(null, `${videoId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowed = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Invalid file type. Accepted: mp4, webm, mov, avi, mkv"));
  },
});

/**
 * POST /api/upload
 * Accepts a video file, saves it, triggers transcription.
 * Returns { videoId, filename, transcriptStatus: "pending" }
 */
router.post("/upload", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided" });
    }

    const videoId = path.basename(req.file.filename, path.extname(req.file.filename));
    const filePath = req.file.path;

    console.log(`[upload] Received: ${req.file.originalname} → ${videoId}`);

    // Save registry entry
    const registryPath = path.join(__dirname, "../uploads/registry.json");
    let registry = {};
    if (fs.existsSync(registryPath)) {
      registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    }
    registry[videoId] = {
      videoId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      filePath,
    };
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

    // Kick off transcription (non-blocking)
    runTranscription(videoId, filePath).catch((err) => {
      console.error(`[transcription] Failed for ${videoId}:`, err.message);
    });

    res.json({
      videoId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      message: "Upload successful. Transcription started.",
    });
  } catch (err) {
    console.error("[upload] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
