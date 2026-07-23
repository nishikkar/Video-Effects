from faster_whisper import WhisperModel
import os
import sys
import json

if len(sys.argv) != 4:
    print("Usage: python transcribe_fast.py <audio_path> <output_json> <model>")
    sys.exit(1)

audio_path = sys.argv[1]
output_json = sys.argv[2]
model_size = sys.argv[3]

device = os.getenv("WHISPER_DEVICE", "cpu").strip().lower()
compute_type = (os.getenv("WHISPER_COMPUTE_TYPE") or "").strip()
if not compute_type:
    compute_type = "float16" if device == "cuda" else "int8"

beam_size = max(1, int(os.getenv("WHISPER_BEAM_SIZE", "1")))
vad_raw = os.getenv("WHISPER_VAD_FILTER", "true").strip().lower()
vad_filter = vad_raw in ("1", "true", "yes")
language = (os.getenv("WHISPER_LANGUAGE") or "").strip() or None

print(f"Loading model {model_size!r} ({device}, {compute_type})...")

model = WhisperModel(model_size, device=device, compute_type=compute_type)

transcribe_kw = {
    "beam_size": beam_size,
    "vad_filter": vad_filter,
    "word_timestamps": True,
}
if language:
    transcribe_kw["language"] = language

print("Starting transcription...")

segments, info = model.transcribe(audio_path, **transcribe_kw)

try:
    audio_duration = float(getattr(info, "duration", 0) or 0)
except (TypeError, ValueError):
    audio_duration = 0.0

result = {
    "duration": audio_duration,
    "segments": [],
}

for segment in segments:
    seg = {
        "start": segment.start,
        "end": segment.end,
        "text": segment.text,
        "words": []
    }

    if segment.words:
        for word in segment.words:
            seg["words"].append({
                "word": word.word,
                "start": word.start,
                "end": word.end
            })

    # faster-whisper often omits word alignments (None/[]) while still filling text,
    # especially with int8 + VAD. Split text across the segment timeline for convert_transcript.
    if not seg["words"] and segment.text and segment.text.strip():
        tokens = segment.text.strip().split()
        duration = max(float(segment.end) - float(segment.start), 0.02)
        n = len(tokens)
        for i, tok in enumerate(tokens):
            t_start = float(segment.start) + (i / n) * duration
            t_end = float(segment.start) + ((i + 1) / n) * duration
            seg["words"].append({
                "word": tok,
                "start": t_start,
                "end": t_end,
            })

    result["segments"].append(seg)

with open(output_json, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False)

print("Done")
