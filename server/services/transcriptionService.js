const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const TRANSCRIPTS_DIR = path.join(__dirname, "../transcripts");

// Whisper model to use — override with WHISPER_MODEL env var
const WHISPER_MODEL = process.env.WHISPER_MODEL || "base";

/**
 * Resolves the Python executable.
 * On Windows 'python3' often doesn't exist — falls back to 'python'.
 */
function getPythonBin() {
  return process.env.PYTHON_PATH || process.env.PYTHON_BIN || "python";
}

/**
 * Locates transcribe_fast.py.
 * Checks scripts/ first, then the main monorepo path.
 */
function getTranscribeScript() {
  const local = path.join(__dirname, "../scripts/transcribe_fast.py");
  if (fs.existsSync(local)) return local;

  const monorepo = path.join(
    __dirname,
    "../../../../descript-editor/server/src/transcribe_fast.py"
  );
  if (fs.existsSync(monorepo)) return monorepo;

  throw new Error(
    "transcribe_fast.py not found. Copy it into video_effects/server/scripts/"
  );
}

/**
 * Converts the raw Whisper JSON output ({ duration, segments })
 * into our canonical transcript format ({ video_id, words, clip_end, ... }).
 *
 * The script already handles word-level fallback internally,
 * so every segment's .words array is always populated.
 */
function convertWhisperOutput(raw, videoId, sourceFile) {
  let wordId = 1;
  const words = [];

  for (const seg of raw.segments || []) {
    for (const w of seg.words || []) {
      const text = (w.word || "").trim();
      if (!text) continue;
      words.push({
        id: `w${String(wordId++).padStart(3, "0")}`,
        word: text,
        start: parseFloat(Number(w.start).toFixed(3)),
        end:   parseFloat(Number(w.end).toFixed(3)),
      });
    }
  }

  const clipEnd = words.length > 0
    ? words[words.length - 1].end
    : parseFloat(Number(raw.duration || 0).toFixed(3));

  return {
    video_id: videoId,
    source_video: path.basename(sourceFile),
    clip_start: 0,
    clip_end: clipEnd,
    words,
    protected_ranges: [],
    question_timestamps: [],
    thinking_ranges: [],
  };
}

/**
 * Main transcription runner.
 *
 * Script signature: transcribe_fast.py <audio_path> <output_json> <model>
 *
 * The script writes raw Whisper JSON to <output_json>.
 * We then read that file, convert it to our canonical format,
 * and write the final transcript to transcripts/<videoId>.json.
 */
async function runTranscription(videoId, videoFilePath) {
  const pendingPath = path.join(TRANSCRIPTS_DIR, `${videoId}.pending`);
  const finalPath   = path.join(TRANSCRIPTS_DIR, `${videoId}.json`);
  const rawPath     = path.join(TRANSCRIPTS_DIR, `${videoId}.raw.json`);
  const errorPath   = path.join(TRANSCRIPTS_DIR, `${videoId}.error`);

  // Clear any previous error/raw files
  [errorPath, rawPath].forEach((f) => { if (fs.existsSync(f)) fs.unlinkSync(f); });

  // Mark as pending
  fs.writeFileSync(pendingPath, new Date().toISOString());

  return new Promise((resolve, reject) => {
    let scriptPath;
    try {
      scriptPath = process.env.TRANSCRIBE_SCRIPT || getTranscribeScript();
    } catch (e) {
      fs.writeFileSync(errorPath, e.message);
      if (fs.existsSync(pendingPath)) fs.unlinkSync(pendingPath);
      return reject(e);
    }

    const python = getPythonBin();

    // Exact signature: <audio_path> <output_json> <model>
    const args = [scriptPath, videoFilePath, rawPath, WHISPER_MODEL];

    console.log(`[transcription] Running: ${python} ${args.join(" ")}`);

    const proc = spawn(python, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => { stdout += d.toString(); process.stdout.write(d); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); process.stderr.write(d); });

    proc.on("close", (code) => {
      if (fs.existsSync(pendingPath)) fs.unlinkSync(pendingPath);

      if (code !== 0) {
        const errMsg = `Transcription failed (exit ${code}):\n${stderr}`;
        console.error(`[transcription] ${errMsg}`);
        fs.writeFileSync(errorPath, errMsg);
        return reject(new Error(errMsg));
      }

      // Read the raw JSON the script wrote
      if (!fs.existsSync(rawPath)) {
        const errMsg = `Script exited 0 but output file not found: ${rawPath}`;
        fs.writeFileSync(errorPath, errMsg);
        return reject(new Error(errMsg));
      }

      try {
        const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
        const transcript = convertWhisperOutput(raw, videoId, videoFilePath);
        fs.writeFileSync(finalPath, JSON.stringify(transcript, null, 2));
        console.log(`[transcription] ✓ Transcript ready: ${transcript.words.length} words, ${transcript.clip_end}s`);
        resolve(finalPath);
      } catch (parseErr) {
        const errMsg = `Failed to convert Whisper output: ${parseErr.message}`;
        fs.writeFileSync(errorPath, errMsg);
        reject(new Error(errMsg));
      }
    });

    proc.on("error", (err) => {
      if (fs.existsSync(pendingPath)) fs.unlinkSync(pendingPath);
      const errMsg = `Could not start Python: ${err.message}\nMake sure Python is installed and on PATH, or set PYTHON_PATH env var.`;
      fs.writeFileSync(errorPath, errMsg);
      reject(new Error(errMsg));
    });
  });
}

module.exports = { runTranscription };