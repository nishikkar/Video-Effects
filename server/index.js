require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Ensure required directories exist
const DIRS = [
  path.join(__dirname, "uploads"),
  path.join(__dirname, "outputs"),
  path.join(__dirname, "transcripts"),
  path.join(__dirname, "assets/sfx"),
];
DIRS.forEach((d) => fs.mkdirSync(d, { recursive: true }));

// Routes
app.use("/api", require("./routes/upload"));
app.use("/api", require("./routes/transcript"));
app.use("/api", require("./routes/sfx"));
app.use("/api", require("./routes/export"));

// Serve output files
app.use("/outputs", express.static(path.join(__dirname, "outputs")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Health check
app.get("/health", (req, res) => res.json({
  status: "ok",
  aiProvider: process.env.AI_PROVIDER || "groq",
  whisperModel: process.env.WHISPER_MODEL || "base",
}));

// Catch-all: serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🎬 video_effects server running at http://localhost:${PORT}`);
  console.log(`🤖 AI provider: ${process.env.AI_PROVIDER || "groq"}`);
  console.log(`🎙️  Whisper model: ${process.env.WHISPER_MODEL || "base"}\n`);
});