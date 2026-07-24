FROM node:20-bookworm-slim

# --- System deps: python (for faster-whisper transcription), ffmpeg, build tools ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    ffmpeg \
    curl \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# --- Poetry (for the faster-whisper python env) ---
ENV POETRY_HOME=/opt/poetry
RUN curl -sSL https://install.python-poetry.org | python3 - \
    && ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

WORKDIR /app

# --- Node deps (cached layer) ---
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm install --omit=dev

# --- Python deps (cached layer) ---
COPY server/pyproject.toml server/poetry.lock server/poetry.toml ./server/
RUN cd server && poetry install --no-root

# --- App code ---
COPY frontend ./frontend
COPY server ./server

# HF Spaces containers run as a non-root user; make writable dirs for uploads/outputs/transcripts
RUN mkdir -p server/uploads server/outputs server/transcripts server/assets/sfx \
    && chmod -R 777 /app

# Point the Node app at the Poetry-managed venv's python for the whisper subprocess
ENV PYTHON_PATH=/app/server/.venv/bin/python

# Don't hardcode PORT — HF Spaces expects 7860, Render/Fly inject their own via env.
# The app already falls back to 5050 if PORT isn't set (see index.js).
EXPOSE 7860

WORKDIR /app/server
CMD ["node", "index.js"]