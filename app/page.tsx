'use client';

import { useState } from 'react';
import type { RepairGuide } from '@/lib/types';
import { UrlInputForm } from '@/components/UrlInputForm';
import { LoadingState } from '@/components/LoadingState';
import { GuideResults } from '@/components/GuideResults';
import { ErrorAlert } from '@/components/ErrorAlert';
import { ShareButton } from '@/components/ShareButton';
import { RegenerateButton } from '@/components/RegenerateButton';
import { PrintButton } from '@/components/PrintButton';
import { GarageModal } from '@/components/GarageModal';
import { extractVideoId } from '@/lib/youtube';

type Status = 'idle' | 'loading' | 'success' | 'error';

interface ResultMeta {
  framesAnalyzed: number;
  researchPerformed: boolean;
  commentsAnalyzed: number;
  provider: string;
  model: string;
  fromCache: boolean;
  cachedAt?: number;
  url: string;
}

type NavItem = 'dashboard' | 'guides' | 'generator' | 'settings';

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [guide, setGuide] = useState<RepairGuide | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [meta, setMeta] = useState<ResultMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [garageOpen, setGarageOpen] = useState(false);
  const [garageVersion, setGarageVersion] = useState(0);
  const [activeNav, setActiveNav] = useState<NavItem>('generator');

  async function runAnalysis(url: string, provider: string, model: string, force: boolean) {
    setStatus('loading');
    setError(null);
    setActiveNav('guides');
    if (!force) {
      setGuide(null);
      setFrames([]);
      setMeta(null);
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, provider, model, force }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }

      setGuide(data.guide);
      setFrames(data.frames ?? []);
      setMeta({
        framesAnalyzed: data.framesAnalyzed ?? 0,
        researchPerformed: data.researchPerformed ?? false,
        commentsAnalyzed: data.commentsAnalyzed ?? 0,
        provider: data.provider,
        model: data.model,
        fromCache: data.fromCache ?? false,
        cachedAt: data.cachedAt,
        url,
      });
      setStatus('success');
    } catch {
      setError('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  }

  function handleSubmit(url: string, provider: string, model: string) {
    runAnalysis(url, provider, model, false);
  }

  function handleRegenerate() {
    if (!meta) return;
    runAnalysis(meta.url, meta.provider, meta.model, true);
  }

  const videoId = meta ? extractVideoId(meta.url) : null;

  const navItems: Array<{ id: NavItem; icon: string; label: string }> = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
    { id: 'guides', icon: 'menu_book', label: 'Guide Library' },
    { id: 'generator', icon: 'construction', label: 'Generator' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans">
      {/* ── Top App Bar ─────────────────────────────────────────────────── */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-surface-container-lowest border-b border-surface-container-highest shadow-ambient print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-lg">build</span>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest text-primary uppercase">SHIFT TERMINAL V2.0</p>
            <p className="text-sm font-bold uppercase tracking-tight text-on-surface leading-none">GARAGE PORTAL</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-gutter">
          <div className="bg-surface-container-low flex items-center px-4 py-2 border border-surface-container-highest rounded">
            <span className="material-symbols-outlined text-outline mr-2 text-base">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 text-xs placeholder:text-outline w-56 outline-none tracking-widest uppercase font-bold"
              placeholder="SEARCH GUIDES..."
              type="text"
            />
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setGarageOpen(true)}
              title="My Garage"
              className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
            >
              garage
            </button>
            <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors">notifications</span>
            <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors">account_circle</span>
          </div>
        </div>
      </header>

      {/* ── Side Nav ────────────────────────────────────────────────────── */}
      <nav className="hidden lg:flex flex-col fixed left-0 top-0 h-full border-r border-surface-container-highest z-40 bg-surface-container-lowest w-64 pt-20 print:hidden">
        <div className="px-6 mb-8">
          <button
            onClick={() => { setActiveNav('generator'); if (status !== 'idle') setStatus('idle'); }}
            className="w-full bg-primary text-on-primary text-label-caps py-3 mt-2 font-bold rounded shadow-sm hover:bg-primary-container active:scale-95 transition-all uppercase tracking-widest"
          >
            NEW REPAIR
          </button>
        </div>

        <div className="flex flex-col flex-1">
          {navItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={[
                  'px-6 py-4 flex items-center gap-3 border-l-4 transition-all text-label-caps text-sm text-left',
                  isActive
                    ? 'bg-primary-fixed text-primary border-primary font-bold'
                    : 'text-on-surface-variant border-transparent hover:bg-surface-container-low hover:text-on-surface',
                ].join(' ')}
              >
                <span className="material-symbols-outlined text-base">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="p-6 border-t border-surface-container-highest">
          <button
            onClick={() => setGarageOpen(true)}
            className="text-on-surface-variant flex items-center gap-3 mb-4 text-label-caps text-xs hover:text-primary transition-colors w-full text-left"
          >
            <span className="material-symbols-outlined text-sm">garage</span>
            MY GARAGE
          </button>
          <a className="text-on-surface-variant flex items-center gap-3 text-label-caps text-xs hover:text-error transition-colors" href="#">
            <span className="material-symbols-outlined text-sm">help_outline</span>
            SUPPORT
          </a>
        </div>
      </nav>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <main className="lg:ml-64 pt-24 px-gutter lg:px-margin pb-xl">

        {/* Generator / idle state */}
        {(activeNav === 'generator' || status === 'idle') && status !== 'loading' && status !== 'success' && (
          <div className="max-w-3xl">
            <div className="mb-8 border-l-4 border-primary pl-6">
              <h1 className="text-3xl font-bold text-on-surface uppercase tracking-tight mb-2">
                Generate Repair Guide
              </h1>
              <p className="text-on-surface-variant">
                Paste a YouTube repair video URL to generate a structured guide with parts, tools, torque specs, and step-by-step instructions.
              </p>
            </div>

            <div className="bg-surface-container-lowest border border-surface-container-highest rounded-lg shadow-ambient p-6 mb-gutter">
              <p className="text-label-caps text-on-surface-variant mb-4 uppercase">Video URL</p>
              <UrlInputForm onSubmit={handleSubmit} isLoading={status === 'loading'} />
            </div>

            {status === 'error' && error && <ErrorAlert message={error} />}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-gutter mt-gutter">
              {[
                { icon: 'biotech', title: 'Research-First AI', desc: 'Pre-researches the repair topic before watching the video' },
                { icon: 'movie', title: 'Frame & Comments Analysis', desc: 'Analyzes video frames and viewer feedback for accuracy' },
                { icon: 'garage', title: 'Save Your Vehicles', desc: 'Save vehicles to your garage and check applicability instantly' },
              ].map((f) => (
                <div key={f.title} className="bg-surface-container-lowest border border-surface-container-highest rounded-lg p-4">
                  <span className="material-symbols-outlined text-primary text-2xl mb-2 block">{f.icon}</span>
                  <p className="text-label-caps text-on-surface font-bold mb-1 uppercase tracking-wide">{f.title}</p>
                  <p className="text-xs text-on-surface-variant">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading state */}
        {status === 'loading' && <LoadingState />}

        {/* Error state (when in guide view) */}
        {status === 'error' && error && activeNav !== 'generator' && (
          <div className="max-w-3xl">
            <ErrorAlert message={error} />
          </div>
        )}

        {/* Guide results */}
        {status === 'success' && guide && meta && (
          <>
            {/* Guide header */}
            <div className="mb-8 border-l-4 border-primary pl-6">
              <div className="flex flex-wrap gap-2 items-center mb-2">
                {guide.difficulty === 'expert' || guide.difficulty === 'advanced' ? (
                  <span className="bg-error text-on-error text-label-caps px-2 py-0.5 text-[10px] rounded-sm uppercase">
                    {guide.difficulty === 'expert' ? 'CRITICAL REPAIR' : 'ADVANCED REPAIR'}
                  </span>
                ) : null}
                {guide.difficulty && (
                  <span className="bg-surface-container-high text-on-surface-variant text-label-caps px-2 py-0.5 text-[10px] rounded-sm uppercase">
                    DIFFICULTY: {guide.difficulty.toUpperCase()}
                  </span>
                )}
                {meta.fromCache && (
                  <span className="bg-secondary-container text-on-secondary-container text-label-caps px-2 py-0.5 text-[10px] rounded-sm uppercase">
                    CACHED
                  </span>
                )}
                {meta.researchPerformed && (
                  <span className="bg-primary-fixed text-primary text-label-caps px-2 py-0.5 text-[10px] rounded-sm uppercase">
                    RESEARCH-ENHANCED
                  </span>
                )}
                {meta.framesAnalyzed > 0 && (
                  <span className="bg-surface-container-high text-on-surface-variant text-label-caps px-2 py-0.5 text-[10px] rounded-sm uppercase">
                    {meta.framesAnalyzed} FRAMES
                  </span>
                )}
              </div>

              <h1 className="text-2xl lg:text-3xl font-bold text-on-surface uppercase tracking-tight mb-2">
                {guide.videoTitle}
              </h1>
              <p className="text-on-surface-variant max-w-3xl">{guide.summary}</p>

              <div className="flex flex-wrap gap-2 mt-4 print:hidden">
                <PrintButton />
                {videoId && (
                  <ShareButton videoId={videoId} provider={meta.provider} model={meta.model} />
                )}
                <RegenerateButton onRegenerate={handleRegenerate} />
              </div>
            </div>

            <GuideResults
              key={garageVersion}
              guide={guide}
              frames={frames}
              provider={meta.provider}
              model={meta.model}
            />
          </>
        )}
      </main>

      <GarageModal
        isOpen={garageOpen}
        onClose={() => setGarageOpen(false)}
        onChange={() => setGarageVersion((v) => v + 1)}
      />
    </div>
  );
}
