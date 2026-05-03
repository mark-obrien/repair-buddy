import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { mkdtemp, readFile, unlink, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Readable } from 'stream';

export class FrameExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrameExtractionError';
  }
}

const FFMPEG_PATH = process.env.FFMPEG_PATH;
if (FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(FFMPEG_PATH);
}

const FRAME_COUNT = 8;
const FRAME_WIDTH = 640;
const JPEG_QUALITY = 4;

export interface FrameExtractionResult {
  frames: string[];
  count: number;
}

function getFrameTimestamps(durationSeconds: number, count: number): number[] {
  if (durationSeconds <= 0) return [];
  // Skip first 10% (intros) and last 15% (outros). Even spacing inside.
  const startSeconds = Math.max(5, durationSeconds * 0.1);
  const endSeconds = durationSeconds * 0.85;
  const usableDuration = endSeconds - startSeconds;
  if (usableDuration <= 0) return [Math.max(1, durationSeconds / 2)];

  const interval = usableDuration / (count + 1);
  const timestamps: number[] = [];
  for (let i = 1; i <= count; i++) {
    timestamps.push(Math.round(startSeconds + interval * i));
  }
  return timestamps;
}

export async function extractVideoFrames(
  videoUrl: string,
  durationSeconds: number
): Promise<FrameExtractionResult> {
  const timestamps = getFrameTimestamps(durationSeconds, FRAME_COUNT);
  if (timestamps.length === 0) {
    return { frames: [], count: 0 };
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'repairbuddy-frames-'));

  try {
    // Get a video stream URL via ytdl-core
    const info = await ytdl.getInfo(videoUrl);
    // Pick the lowest-quality video format with at least video — we don't need 4K to extract frames
    const format = ytdl.chooseFormat(info.formats, { quality: 'lowestvideo' });
    if (!format?.url) {
      throw new FrameExtractionError('No usable video stream found.');
    }

    const framePromises = timestamps.map((seconds, i) => extractSingleFrame(format.url, seconds, tempDir, i));
    const frames = await Promise.all(framePromises);
    const validFrames = frames.filter((f): f is string => f !== null);

    return { frames: validFrames, count: validFrames.length };
  } catch (err) {
    if (err instanceof FrameExtractionError) throw err;
    throw new FrameExtractionError(err instanceof Error ? err.message : 'Frame extraction failed.');
  } finally {
    try { await rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

async function extractSingleFrame(
  videoStreamUrl: string,
  timestampSeconds: number,
  tempDir: string,
  index: number
): Promise<string | null> {
  const framePath = join(tempDir, `frame-${index}.jpg`);

  return new Promise((resolve) => {
    ffmpeg(videoStreamUrl)
      .seekInput(timestampSeconds)
      .frames(1)
      .size(`${FRAME_WIDTH}x?`)
      .outputOptions([`-q:v ${JPEG_QUALITY}`])
      .on('error', (err) => {
        console.warn(`Frame ${index} extraction failed:`, err.message);
        resolve(null);
      })
      .on('end', async () => {
        try {
          const buffer = await readFile(framePath);
          await unlink(framePath).catch(() => {});
          resolve(buffer.toString('base64'));
        } catch (err) {
          console.warn(`Frame ${index} read failed:`, err);
          resolve(null);
        }
      })
      .save(framePath);
  });
}

// Type guard for Readable streams (unused here but kept for future stream-based extraction)
export type _StreamGuard = Readable;
