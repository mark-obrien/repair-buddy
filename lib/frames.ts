import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { PassThrough } from 'stream';

// Point fluent-ffmpeg at the static binary
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const FRAME_COUNT = 8;
const FRAME_WIDTH = 640;
const SINGLE_FRAME_TIMEOUT_MS = 10_000;

export interface FrameExtractionResult {
  frames: string[]; // base64 JPEG strings
  durationSeconds: number;
}

export async function extractVideoFrames(
  videoUrl: string,
  fallbackDurationSeconds: number
): Promise<FrameExtractionResult> {
  // Get video info and direct stream URL
  let streamUrl: string;
  let durationSeconds = fallbackDurationSeconds;

  try {
    const info = await ytdl.getInfo(videoUrl);
    durationSeconds = parseInt(info.videoDetails.lengthSeconds) || fallbackDurationSeconds;

    // Prefer lowest-quality video-only format for fast seeking
    const format =
      ytdl.chooseFormat(info.formats, { quality: 'lowest', filter: 'videoonly' }) ??
      ytdl.chooseFormat(info.formats, { quality: 'lowest' });
    streamUrl = format.url;
  } catch (err) {
    throw new FrameExtractionError(
      `Could not retrieve video stream: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }

  // Spread timestamps from 10% to 85% of video duration
  const timestamps = Array.from({ length: FRAME_COUNT }, (_, i) =>
    Math.floor(durationSeconds * (0.10 + (i * 0.75) / (FRAME_COUNT - 1)))
  );

  // Extract all frames in parallel; partial failure is acceptable
  const results = await Promise.allSettled(
    timestamps.map((ts) => extractSingleFrame(streamUrl, ts))
  );

  const frames = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value !== '')
    .map((r) => r.value);

  if (frames.length === 0) {
    throw new FrameExtractionError('No frames could be extracted from this video.');
  }

  return { frames, durationSeconds };
}

function extractSingleFrame(streamUrl: string, timestamp: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const pass = new PassThrough();

    const timer = setTimeout(() => {
      pass.destroy();
      reject(new Error(`Frame extraction timed out at ${timestamp}s`));
    }, SINGLE_FRAME_TIMEOUT_MS);

    pass.on('data', (chunk: Buffer) => chunks.push(chunk));
    pass.on('end', () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString('base64'));
    });
    pass.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ffmpeg(streamUrl)
      .inputOptions([
        `-ss ${timestamp}`,
        '-reconnect 1',
        '-reconnect_streamed 1',
        '-reconnect_delay_max 3',
      ])
      .outputOptions([
        '-frames:v 1',
        `-vf scale=${FRAME_WIDTH}:-2`,
        '-q:v 4', // JPEG quality 4 (1=best, 31=worst) — good balance
      ])
      .format('mjpeg')
      .on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      })
      .pipe(pass, { end: true });
  });
}

export class FrameExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrameExtractionError';
  }
}
