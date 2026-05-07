import mysql from 'mysql2/promise';
import type { RepairGuide } from './types';

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    const url = process.env.MYSQL_URL;
    if (!url) throw new Error('MYSQL_URL environment variable is not set.');
    pool = mysql.createPool(url);
  }
  return pool;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function query<T>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params);
  return rows as T[];
}

// ---------------------------------------------------------------------------
// Schema init — called once at startup
// ---------------------------------------------------------------------------
export async function initDb(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS transcripts (
      video_id   VARCHAR(11)  NOT NULL PRIMARY KEY,
      text       LONGTEXT     NOT NULL,
      created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS guides (
      video_id            VARCHAR(11)   NOT NULL,
      provider            VARCHAR(50)   NOT NULL,
      model               VARCHAR(100)  NOT NULL,
      category            VARCHAR(20)   NOT NULL DEFAULT 'auto',
      guide               JSON          NOT NULL,
      frames              JSON          NOT NULL,
      frames_analyzed     INT           NOT NULL DEFAULT 0,
      research_performed  TINYINT(1)    NOT NULL DEFAULT 0,
      comments_analyzed   INT           NOT NULL DEFAULT 0,
      created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (video_id, provider, model)
    )
  `);

  console.log('✓ MySQL tables ready');
}

initDb().catch((err) => console.error('DB init failed:', err instanceof Error ? err.message : err));

// ---------------------------------------------------------------------------
// Transcripts
// ---------------------------------------------------------------------------
export async function getCachedTranscript(videoId: string): Promise<string | null> {
  const rows = await query<{ text: string }>(
    'SELECT text FROM transcripts WHERE video_id = ?',
    [videoId]
  );
  if (rows.length) {
    console.log(`✓ Transcript DB hit: ${videoId}`);
    return rows[0].text;
  }
  return null;
}

export async function cacheTranscript(videoId: string, text: string): Promise<void> {
  await query(
    'INSERT INTO transcripts (video_id, text) VALUES (?, ?) ON DUPLICATE KEY UPDATE text = VALUES(text)',
    [videoId, text]
  );
}

// ---------------------------------------------------------------------------
// Guides
// ---------------------------------------------------------------------------
export interface StoredGuide {
  guide: RepairGuide;
  framesAnalyzed: number;
  researchPerformed: boolean;
  commentsAnalyzed: number;
  provider: string;
  model: string;
  cachedAt: number;
  frames?: string[];
}

export async function getCachedGuide(
  videoId: string,
  provider: string,
  model: string
): Promise<StoredGuide | null> {
  const rows = await query<{
    guide: string;
    frames: string;
    frames_analyzed: number;
    research_performed: number;
    comments_analyzed: number;
    created_at: Date;
  }>(
    'SELECT guide, frames, frames_analyzed, research_performed, comments_analyzed, created_at FROM guides WHERE video_id = ? AND provider = ? AND model = ?',
    [videoId, provider, model]
  );

  if (!rows.length) return null;
  const row = rows[0];
  console.log(`✓ Guide DB hit: ${videoId} (${provider}/${model})`);

  return {
    guide: typeof row.guide === 'string' ? JSON.parse(row.guide) : row.guide,
    frames: typeof row.frames === 'string' ? JSON.parse(row.frames) : (row.frames as unknown as string[]),
    framesAnalyzed: row.frames_analyzed,
    researchPerformed: Boolean(row.research_performed),
    commentsAnalyzed: row.comments_analyzed,
    provider,
    model,
    cachedAt: row.created_at.getTime(),
  };
}

export async function cacheGuide(
  videoId: string,
  provider: string,
  model: string,
  payload: Omit<StoredGuide, 'cachedAt'>
): Promise<void> {
  await query(
    `INSERT INTO guides
       (video_id, provider, model, guide, frames, frames_analyzed, research_performed, comments_analyzed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       guide = VALUES(guide),
       frames = VALUES(frames),
       frames_analyzed = VALUES(frames_analyzed),
       research_performed = VALUES(research_performed),
       comments_analyzed = VALUES(comments_analyzed),
       created_at = CURRENT_TIMESTAMP`,
    [
      videoId,
      provider,
      model,
      JSON.stringify(payload.guide),
      JSON.stringify(payload.frames ?? []),
      payload.framesAnalyzed,
      payload.researchPerformed ? 1 : 0,
      payload.commentsAnalyzed,
    ]
  );
  console.log(`✓ Guide stored: ${videoId} (${provider}/${model})`);
}

export async function deleteGuide(
  videoId: string,
  provider: string,
  model: string
): Promise<void> {
  await query(
    'DELETE FROM guides WHERE video_id = ? AND provider = ? AND model = ?',
    [videoId, provider, model]
  );
}

export async function getAllGuides(): Promise<StoredGuide[]> {
  const rows = await query<{
    video_id: string;
    guide: string;
    frames: string;
    frames_analyzed: number;
    research_performed: number;
    comments_analyzed: number;
    provider: string;
    model: string;
    created_at: Date;
  }>(
    'SELECT video_id, guide, frames, frames_analyzed, research_performed, comments_analyzed, provider, model, created_at FROM guides ORDER BY created_at DESC'
  );

  return rows.map((row) => ({
    guide: typeof row.guide === 'string' ? JSON.parse(row.guide) : row.guide,
    frames: typeof row.frames === 'string' ? JSON.parse(row.frames) : (row.frames as unknown as string[]),
    framesAnalyzed: row.frames_analyzed,
    researchPerformed: Boolean(row.research_performed),
    commentsAnalyzed: row.comments_analyzed,
    provider: row.provider,
    model: row.model,
    cachedAt: row.created_at.getTime(),
  }));
}
