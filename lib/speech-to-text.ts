// Speech-to-text transcription using OpenAI Whisper
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AUDIO_TIMEOUT_MS = 60000; // 60 seconds
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB (Whisper limit)

export class SpeechToTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeechToTextError';
  }
}

async function extractAudio(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempFile = path.join('/tmp', `audio-${Date.now()}.mp3`);

    try {
      const stream = ytdl(videoUrl, { quality: 'lowest' });
      
      ffmpeg(stream)
        .toFormat('mp3')
        .audioFrequency(16000)
        .on('error', (err) => {
          reject(new SpeechToTextError(`Audio extraction failed: ${err.message}`));
        })
        .on('end', () => {
          resolve(tempFile);
        })
        .saveToFile(tempFile);
    } catch (err) {
      reject(new SpeechToTextError(`Could not extract audio: ${err instanceof Error ? err.message : 'unknown error'}`));
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
    const transcript = await openai.audio.transcriptions.create({
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
