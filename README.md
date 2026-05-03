# Repair Buddy

Paste a YouTube repair video URL and get an AI-generated companion guide — parts list, tools, torque specs, step-by-step instructions, warnings, and visual diagrams.

## Features

### Guide generation
- Structured repair guides from YouTube video transcripts
- Parts list with part numbers, quantities, and notes
- Standard and specialty tools with sizes and DIY alternatives
- Torque specifications extracted verbatim (safety-critical)
- Numbered repair steps with inline warnings
- **Difficulty rating** (beginner / intermediate / advanced / expert) with reasoning
- **Estimated time** in minutes
- **Frame-grounded steps** — each step shows the most representative video frame inline
- Mermaid process flowchart
- SVG parts diagram with labeled components
- Whisper speech-to-text fallback for videos without captions
- Multi-provider AI: Anthropic, OpenAI, Google

### Context enrichment
- **Pre-research phase** — a fast/cheap model researches the repair topic before video analysis
- **Video frame analysis** — 8 frames extracted and fed to vision models for accurate diagrams
- **Comments mining** (optional) — top viewer comments fed into the guide for corrections and gotchas

### User-facing
- **Save & share** — every guide is cached for 7 days; one-click share links
- **My Garage** — save your vehicles in your browser; instant applicability check on every guide
- **Shopping links** — search RockAuto, Amazon, AutoZone, O'Reilly, eBay Motors for any part
- **Torque unit toggle** — display values in ft-lbs / Nm / in-lbs / kg-m on demand
- **Print / Save as PDF** — full-guide print stylesheet, all tabs in one document
- **Regenerate** — bypass the cache and rebuild the guide from scratch
- Transcript and full-guide caching (in-memory + optional Redis)

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
| `REDIS_URL` | No | Transcript + guide cache (e.g. `redis://localhost:6379`) |
| `YOUTUBE_API_KEY` | No | Enables top-comments mining for additional context |
| `FFMPEG_PATH` | No | Override ffmpeg binary path (default: auto-detected) |

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Production (Docker)

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
docker compose up --build
```

Open [http://localhost:6788](http://localhost:6788).

---

## Notes

- **Videos without captions** fall back to OpenAI Whisper (requires `OPENAI_API_KEY`).
- **Frame extraction** requires ffmpeg. Skipped silently if unavailable.
- **My Garage** is browser-only — vehicles are stored in `localStorage`. No accounts, no servers.
- **Shopping links** are plain search URLs — Repair Buddy is not paid for clicks. The structure makes it easy to add affiliate tags via env vars later.
- **Comments mining** is optional and degrades gracefully — guide generation still works without `YOUTUBE_API_KEY`.
- **Cache lifetime**: transcripts 24h, full guides 7 days. Generating the same video again with the same model serves instantly from cache.
- **Share links** look like `/g/{videoId}?p={provider}&m={model}` and survive for 7 days (the cache TTL).
