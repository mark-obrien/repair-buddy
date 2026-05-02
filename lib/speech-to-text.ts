// Speech-to-text transcription using OpenAI Whisper
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';

// Resolve the ffmpeg binary path at runtime — same logic as frames.ts so both
// modules share the same resolution strategy rather than relying on ffmpeg-static's __dirname.
function resolveFfmpegPath(): string | null {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const pkgDir = path.dirname(require.resolve('ffmpeg-static/package.json'));
    const bin = path.join(pkgDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    return fs.existsSync(bin) ? bin : null;
  } catch {
    return null;
  }
}

const ffmpegBin = resolveFfmpegPath();
if (ffmpegBin) {
  ffmpeg.setFfmpegPath(ffmpegBin);
}

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new SpeechToTextError('OPENAI_API_KEY is not configured — cannot use speech-to-text fallback.');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const AUDIO_TIMEOUT_MS = 60000; // 60 seconds
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)

export class SpeechToTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeechToTextError';
  }
}

async function extractAudio(videoUrl: string): Promise<string> {
  if (!ffmpegBin) {
    throw new SpeechToTextError('ffmpeg binary not found — speech-to-text is unavailable in this environment. Set the FFMPEG_PATH environment variable to enable it.');
  }

  return new Promise((resolve, reject) => {
    const tempFile = path.join('/tmp', `audio-${Date.now()}.mp3`);

    try {
      const stream = ytdl(videoUrl, { quality: 'lowest' });

      ffmpeg(stream)
        .toFormat('mp3')
        .audioFrequency(16000)
        .on('error', (err) => {
          const msg = err.message ?? '';
          if (msg.includes('playable formats') || msg.includes('No video formats') || msg.includes('status code: 4')) {
            reject(new SpeechToTextError(
              'Could not download audio for this video — it may be age-restricted, region-locked, or require sign-in. Try a video that has captions enabled.'
            ));
          } else {
            reject(new SpeechToTextError(`Audio extraction failed: ${msg}`));
          }
        })
        .on('end', () => {
          resolve(tempFile);
        })
        .saveToFile(tempFile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      if (msg.includes('playable formats') || msg.includes('No video formats')) {
        reject(new SpeechToTextError(
          'Could not download audio for this video — it may be age-restricted or region-locked. Try a video that has captions enabled.'
        ));
      } else {
        reject(new SpeechToTextError(`Could not extract audio: ${msg}`));
      }
    }
  });
}

export async function transcribeSpeech(videoUrl: string): Promise<{ text: string; durationSeconds: number }> {
  let audioFile: string | null = null;

  try {
    // Extract audio with timeout
    audioFile = await Promise.race([
      extractAudio(videoUrl),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new SpeechToTextError('Audio extraction timeout')), AUDIO_TIMEOUT_MS)
      ),
    ]);

    // Check file size
    const stats = fs.statSync(audioFile);
    if (stats.size > MAX_AUDIO_SIZE) {
      throw new SpeechToTextError('Video too long for speech-to-text transcription (>25MB audio)');
    }

    console.log(`🎤 Transcribing audio (${Math.round(stats.size / 1024 / 1024)}MB)...`);

    // Send to Whisper API
    const transcript = await getOpenAIClient().audio.transcriptions.create({
      file: fs.createReadStream(audioFile),
      model: 'whisper-1',
      language: 'en',
    });

    // Rough duration estimate: 16kHz mono MP3 ≈ 32kbps → 4000 bytes/sec
    const durationSeconds = Math.round(stats.size / 4000);

    return {
      text: transcript.text,
      durationSeconds,
    };
  } catch (err) {
    if (err instanceof SpeechToTextError) {
      throw err;
    }
    throw new SpeechToTextError(
      `Speech-to-text failed: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  } finally {
    // Cleanup temp file
    if (audioFile && fs.existsSync(audioFile)) {
      fs.unlinkSync(audioFile);
    }
  }
}
