# Repair Buddy

Paste a YouTube repair video URL and get an AI-generated companion guide — parts list, tools, torque specs, step-by-step instructions, warnings, and visual diagrams.

## Features

- Structured repair guides from YouTube video transcripts
- Parts list with part numbers, quantities, and notes
- Standard and specialty tools with sizes and DIY alternatives
- Torque specifications extracted verbatim (safety-critical)
- Numbered repair steps with inline warnings
- Mermaid process flowchart
- SVG parts diagram with labeled components
- Video frame extraction for more accurate diagrams
- Whisper speech-to-text fallback for videos without captions
- Multi-provider AI: Anthropic, OpenAI, Google
- Transcript caching (in-memory + optional Redis)

---

## Local Development

### Prerequisites

- Node.js 20+
- ffmpeg installed system-wide (`brew install ffmpeg` / `apt install ffmpeg`)
- At least one AI provider API key

### Setup

```bash
git clone <repo>
cd repair-buddy

npm install

cp .env.example .env.local
# Edit .env.local — add at minimum ANTHROPIC_API_KEY
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | One of these three | Claude models |
| `OPENAI_API_KEY` | One of these three | GPT-4o models + Whisper transcription |
| `GOOGLE_GENERATIVE_AI_API_KEY` | One of these three | Gemini models |
| `REDIS_URL` | No | Transcript cache (e.g. `redis://localhost:6379`) |
| `FFMPEG_PATH` | No | Override ffmpeg binary path (default: auto-detected) |

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Production (Docker)

The Docker setup uses system ffmpeg so frame extraction and speech-to-text work reliably without any binary path issues. Redis is included for transcript caching.

### Prerequisites

- Docker and Docker Compose
- API key(s) for at least one AI provider

### Setup

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Run

```bash
docker compose up --build
```

Open [http://localhost:6788](http://localhost:6788).

To run in the background:

```bash
docker compose up --build -d
docker compose logs -f   # tail logs
docker compose down      # stop
```

### Environment variables in production

Pass keys via `.env.local` (Docker Compose reads it automatically) or export them in your shell before running `docker compose up`:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
docker compose up --build -d
```

### Updating

```bash
git pull
docker compose up --build -d
```

---

## Notes

- **Videos without captions**: the app falls back to OpenAI Whisper (requires `OPENAI_API_KEY`). On environments without ffmpeg this fallback is unavailable — the video must have YouTube captions.
- **Frame extraction**: requires ffmpeg. Skipped silently if unavailable — the guide still generates from the transcript alone.
- **Model selection**: each request can specify provider and model via the UI. The research pre-pass always uses the cheapest model in the selected provider family.
