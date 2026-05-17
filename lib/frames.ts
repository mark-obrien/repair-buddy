import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readdir, readFile, unlink, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Readable } from 'stream';

const execFileAsync = promisify(execFile);

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

const FRAME_WIDTH = 640;
const JPEG_QUALITY = 4;

/**
 * Scale frame count with video duration so short clips get reasonable
 * coverage and long tutorials get enough frames to illustrate each step.
 *   < 3 min  →  4 frames
 *   3–8 min  →  8 frames
 *   8–20 min → 12 frames
 *   > 20 min → 16 frames
 */
function getFrameCount(durationSeconds: number): number {
  if (durationSeconds < 180) return 4;
  if (durationSeconds < 480) return 8;
  if (durationSeconds < 1200) return 12;
  return 16;
}

export interface FrameExtractionResult {
  frames: string[];
  count: number;
}

function getFrameTimestamps(durationSeconds: number, count: number): number[] {
  if (durationSeconds <= 0) return [];
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

// ---------------------------------------------------------------------------
// yt-dlp: download video to a local temp file (preferred)
//
// Why download instead of using --get-url:
//   YouTube's direct stream URLs embed time-limited auth tokens and require
//   specific HTTP headers (User-Agent, cookies) that yt-dlp sets automatically
//   but ffmpeg doesn't. Downloading through yt-dlp avoids all of that.
// ---------------------------------------------------------------------------

async function downloadVideoWithYtDlp(
  videoUrl: string,
  tempDir: string
): Promise<string> {
  const ytdlpBin = process.env.YTDLP_PATH ?? 'yt-dlp';
  const outputTemplate = join(tempDir, 'video.%(ext)s');

  // Lowest-quality video-only stream to minimise download size/time.
  // 144p/240p is plenty for frame thumbnails.
  await execFileAsync(
    ytdlpBin,
    [
      '-f', 'worstvideo[ext=mp4]/bestvideo[height<=240][ext=mp4]/worst[ext=mp4]/worst',
      '--no-playlist',
      '--quiet',
      '-o', outputTemplate,
      videoUrl,
    ],
    { timeout: 180_000 }
  );

  const files = await readdir(tempDir);
  const videoFile = files.find((f) => f.startsWith('video.'));
  if (!videoFile) throw new FrameExtractionError('yt-dlp did not produce a video file.');
  return join(tempDir, videoFile);
}

// ---------------------------------------------------------------------------
// ytdl-core: fallback when yt-dlp is absent (returns a stream URL)
// ---------------------------------------------------------------------------

async function getVideoUrlWithYtdlCore(videoUrl: string): Promise<string> {
  const info = await ytdl.getInfo(videoUrl);
  const format = ytdl.chooseFormat(info.formats, { quality: 'lowestvideo' });
  if (!format?.url) throw new FrameExtractionError('No usable video stream found.');
  return format.url;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function extractVideoFrames(
  videoUrl: string,
  durationSeconds: number
): Promise<FrameExtractionResult> {
  const frameCount = getFrameCount(durationSeconds);
  const timestamps = getFrameTimestamps(durationSeconds, frameCount);
  if (timestamps.length === 0) {
    return { frames: [], count: 0 };
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'repairbuddy-frames-'));

  try {
    let videoInput: string;

    try {
      // yt-dlp downloads to a local file — auth tokens and headers handled internally
      videoInput = await downloadVideoWithYtDlp(videoUrl, tempDir);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('ENOENT') || msg.toLowerCase().includes('not found')) {
        // yt-dlp not installed — fall back to ytdl-core stream URL
        console.warn('yt-dlp not found, falling back to ytdl-core for frame extraction');
        videoInput = await getVideoUrlWithYtdlCore(videoUrl);
      } else {
        throw err;
      }
    }

    const framePromises = timestamps.map((seconds, i) =>
      extractSingleFrame(videoInput, seconds, tempDir, i)
    );
    const frames = await Promise.all(framePromises);
    const validFrames = frames.filter((f): f is string => f !== null);

    return { frames: validFrames, count: validFrames.length };
  } catch (err) {
    if (err instanceof FrameExtractionError) throw err;
    throw new FrameExtractionError(
      err instanceof Error ? err.message : 'Frame extraction failed.'
    );
  } finally {
    try { await rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

async function extractSingleFrame(
  videoInput: string,
  timestampSeconds: number,
  tempDir: string,
  index: number
): Promise<string | null> {
  const framePath = join(tempDir, `frame-${index}.jpg`);

  return new Promise((resolve) => {
    ffmpeg(videoInput)
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
        } catch {
          resolve(null);
        }
      })
      .save(framePath);
  });
}

// Type guard kept for potential stream-based extraction
export type _StreamGuard = Readable;
