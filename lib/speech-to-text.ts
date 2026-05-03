import OpenAI from 'openai';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { TranscriptResult } from './transcript';

export class SpeechToTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeechToTextError';
  }
}

const FFMPEG_PATH = process.env.FFMPEG_PATH;
if (FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(FFMPEG_PATH);
}

const MAX_AUDIO_SIZE_MB = 24;

async function downloadAndExtractAudio(videoUrl: string): Promise<{ filePath: string; tempDir: string }> {
  const tempDir = await mkdtemp(join(tmpdir(), 'repairbuddy-audio-'));
  const audioPath = join(tempDir, 'audio.mp3');

  return new Promise((resolve, reject) => {
    try {
      const audioStream = ytdl(videoUrl, {
        quality: 'lowestaudio',
        filter: 'audioonly',
      });

      ffmpeg(audioStream as Readable)
        .audioCodec('libmp3lame')
        .audioBitrate(48)
        .audioChannels(1)
        .audioFrequency(16000)
        .format('mp3')
        .on('error', (err) => reject(new SpeechToTextError(`Audio extraction failed: ${err.message}`)))
        .on('end', () => resolve({ filePath: audioPath, tempDir }))
        .save(audioPath);
    } catch (err) {
      reject(new SpeechToTextError(err instanceof Error ? err.message : 'Audio download failed'));
    }
  });
}

export async function transcribeWithWhisper(videoId: string): Promise<TranscriptResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new SpeechToTextError('Whisper fallback requires OPENAI_API_KEY in .env.local.');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let audioPath: string | null = null;

  try {
    console.log(`Whisper fallback: extracting audio for ${videoId}`);
    const { filePath } = await downloadAndExtractAudio(videoUrl);
    audioPath = filePath;

    const fs = await import('fs');
    const stats = await fs.promises.stat(audioPath);
    if (stats.size > MAX_AUDIO_SIZE_MB * 1024 * 1024) {
      throw new SpeechToTextError(
        `Audio file is too large for Whisper (${(stats.size / 1024 / 1024).toFixed(1)}MB > ${MAX_AUDIO_SIZE_MB}MB).`
      );
    }

    const openai = new OpenAI();
    const audioBuffer = await fs.promises.readFile(audioPath);
    const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });

    const result = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    const segments = (result as { segments?: Array<{ start: number; text: string }> }).segments ?? [];
    if (segments.length === 0) {
      throw new SpeechToTextError('Whisper returned no segments.');
    }

    const lines: string[] = [];
    let currentChunkText: string[] = [];
    let currentChunkStart = segments[0].start;
    const CHUNK_SECONDS = 30;

    for (const seg of segments) {
      if (seg.start - currentChunkStart >= CHUNK_SECONDS && currentChunkText.length > 0) {
        const m = Math.floor(currentChunkStart / 60);
        const s = Math.floor(currentChunkStart % 60);
        lines.push(`[${m}:${String(s).padStart(2, '0')}] ${currentChunkText.join(' ')}`);
        currentChunkText = [];
        currentChunkStart = seg.start;
      }
      currentChunkText.push(seg.text.trim());
    }
    if (currentChunkText.length > 0) {
      const m = Math.floor(currentChunkStart / 60);
      const s = Math.floor(currentChunkStart % 60);
      lines.push(`[${m}:${String(s).padStart(2, '0')}] ${currentChunkText.join(' ')}`);
    }

    const lastSegment = segments[segments.length - 1];
    return {
      text: lines.join('\n\n'),
      durationSeconds: Math.ceil(lastSegment.start),
    };
  } catch (err) {
    if (err instanceof SpeechToTextError) throw err;
    throw new SpeechToTextError(err instanceof Error ? err.message : 'Whisper transcription failed.');
  } finally {
    if (audioPath) {
      try { await unlink(audioPath); } catch { /* ignore */ }
    }
  }
}
