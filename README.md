# video_effects

Standalone folder for testing and iterating on the **video → SFX → output** pipeline.

This project is self-contained inside `video_effects/video_effects`. It runs a Node/Express server, serves a static frontend, transcribes uploaded videos, generates AI-driven SFX placement decisions, and exports a finished video with sound effects mixed in.

---

## What it does

```
Upload video → Transcribe (Whisper) → Analyze transcript with AI → Generate SFX placement → Export video with mixed-in SFX
```

---

## Current structure

```
video_effects/video_effects/
├── frontend/
│   └── index.html                  # Static UI served by the server
├── server/
│   ├── .env                        # local env config (optional)
│   ├── index.js                    # Express server entrypoint
│   ├── package.json
│   ├── package-lock.json
│   ├── node_modules/               # installed server dependencies
│   ├── pyproject.toml              # Python deps for transcription (faster-whisper)
│   ├── poetry.lock                 # pinned Python dependency versions
│   ├── poetry.toml                 # Poetry config: in-project .venv
│   ├── .venv/                      # Poetry virtualenv (created by `poetry install`)
│   ├── routes/
│   │   ├── upload.js               # POST /api/upload
│   │   ├── transcript.js           # GET /api/transcript/:videoId
│   │   ├── sfx.js                  # POST /api/sfx-analyze, GET /api/sfx-analyze/:videoId
│   │   └── export.js               # POST /api/export, GET /api/outputs
│   ├── services/
│   │   ├── transcriptionService.js # Runs Whisper transcription via Python script
│   │   ├── aiService.js            # Provider-agnostic AI request layer
│   │   ├── promptBuilder.js        # Builds SFX prompt + available SFX definitions
│   │   ├── sfxDecisionService.js   # AI-based SFX decision engine
│   │   └── ffmpegService.js        # Mixes SFX into video with FFmpeg
│   ├── scripts/
│   │   └── initSfxPack.js          # Creates placeholder SFX audio files
│   ├── assets/
│   │   └── sfx/                    # SFX source audio files (.wav/.mp3)
│   ├── uploads/                    # Uploaded video files and registry.json
│   ├── outputs/                    # Rendered videos + JSON artifacts
│   └── transcripts/                # Transcript JSON and status marker files
```

---

## Runtime flow

1. Client uploads a video to `POST /api/upload`.
2. Server saves the file in `uploads/`, registers it in `uploads/registry.json`, and starts transcription asynchronously.
3. Transcription writes a JSON transcript to `transcripts/{videoId}.json` and optional `.pending` / `.error` markers.
4. Client calls `POST /api/sfx-analyze` with `videoId`.
5. `sfxDecisionService` builds a prompt, sends it to `aiService`, validates the returned events, and writes `outputs/sfx_decision_{videoId}.json`.
6. Client calls `POST /api/export` with `videoId` and SFX event data (or uses saved decision file).
7. `ffmpegService` mixes the selected SFX into the original video and writes a new MP4 into `outputs/`.

---

## Quick start

### Prerequisites

- **Node.js** (server + frontend)
- **Python 3.10–3.12** with **[Poetry](https://python-poetry.org/)** — transcription runs `faster-whisper` via a Python script (`server/scripts/transcribe_fast.py`)
- **FFmpeg** — bundled via `ffmpeg-static`, no separate install needed

### 1. Python transcription environment (Poetry)

Transcription depends on `faster-whisper`, declared in `server/pyproject.toml`. Poetry is configured (`server/poetry.toml`) to create its virtualenv **in-project** at `server/.venv`, so setup is the same on every machine:

```bash
cd video_effects/video_effects/server
poetry install
```

This creates `server/.venv` with `faster-whisper` installed. The server already points at it via `PYTHON_PATH=.venv\Scripts\python.exe` in `.env` (a stable relative path — no per-machine editing needed).

> **Note:** `faster-whisper`'s dependencies (e.g. `onnxruntime`) don't ship Windows wheels for Python 3.10, so use **Python 3.11 or 3.12**. Pin the interpreter explicitly if needed:
> ```bash
> poetry env use "C:/path/to/python3.12/python.exe"
> poetry install
> ```
> On first run, the Whisper model (`base`, ~145 MB) is downloaded automatically and cached under `~/.cache/huggingface`.

### 2. Node server

```bash
npm install
npm run sfx:init    # Generates placeholder SFX assets in assets/sfx/
npm start
```

Then open `http://localhost:5050`.

---

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload a video, store it, start transcription |
| `GET` | `/api/transcript/:videoId` | Get transcript status or transcript JSON |
| `GET` | `/api/transcript/:videoId/text` | Get plain transcript text |
| `POST` | `/api/sfx-analyze` | Analyze transcript and generate SFX event JSON |
| `GET` | `/api/sfx-analyze/:videoId` | Retrieve cached SFX decision |
| `POST` | `/api/export` | Mix SFX into video and create a new output MP4 |
| `GET` | `/api/outputs` | List output files and metadata |
| `GET` | `/health` | Basic server health / provider info |

---

## Services overview

- `transcriptionService.js` — orchestrates Whisper transcription via a Python script and writes transcript artifacts.
- `aiService.js` — provider-agnostic AI client for `groq`, `ollama`, or `anthropic`.
- `promptBuilder.js` — contains the canonical SFX catalog and builds the exact prompt sent to the AI.
- `sfxDecisionService.js` — validates AI outputs, enforces spacing rules, and returns structured events.
- `ffmpegService.js` — uses FFmpeg to delay and mix SFX into the video audio track.

---

## AI and environment configuration

The server supports multiple AI providers via `.env`.

Common variables:

- `AI_PROVIDER` — `groq`, `ollama`, or `anthropic` (default: `groq`)
- `AI_MODEL` — optional override for provider model
- `GROQ_API_KEY` — required for Groq
- `ANTHROPIC_API_KEY` — required for Anthropic
- `OLLAMA_URL` — optional local Ollama host
- `PYTHON_PATH` or `PYTHON_BIN` — Python executable used for transcription (defaults to the in-project Poetry venv: `.venv\Scripts\python.exe`; falls back to `python` on PATH if unset)
- `TRANSCRIBE_SCRIPT` — optional path to a custom transcription script
- `FFMPEG_PATH` — optional custom FFmpeg binary (defaults to built-in `ffmpeg-static`)

---

## SFX catalog

The project now includes a broader SFX library beyond the original five core assets.

Core SFX:
- `impact_soft`
- `pause_click`
- `question_ping`
- `tension_rise`
- `transition_whoosh`

Added SFX include:
- `clock_tick`
- `breath_exhale`
- `paper_slide`
- `success_chime`
- `success_warm`
- `subtle_pop`
- `warm_chord`
- `notification_ding`
- `soft_error`

These are defined in `server/services/promptBuilder.js`, and the AI prompt describes when each sound is appropriate.

---

## Supported upload and output files

- Accepted upload types: `.mp4`, `.webm`, `.mov`, `.avi`, `.mkv`
- Upload file size limit: 500 MB
- Export output files are written to `server/outputs/`
- SFX decision artifacts are written as `outputs/sfx_decision_{videoId}.json`
- Final exported videos are written as `outputs/sfx_output_{videoId}_{timestamp}.mp4`

---

## Notes for another LLM

This folder is built to demonstrate an end-to-end video SFX pipeline. The server is the main app, with a static frontend in `frontend/` and a service-oriented backend in `server/`.

Key ideas to convey:
- Upload → asynchronous transcription → AI-based SFX placement → FFmpeg export
- AI logic is decoupled from mixing logic
- SFX assets are managed centrally in `promptBuilder.js`
- The server also exposes health status and output listing endpoints
- New SFX assets can be added by placing files in `assets/sfx/` and adding entries to `AVAILABLE_SFX`

Use this README as the current project summary; do not assume the old keyword-based SFX engine is still the only decision mechanism.
