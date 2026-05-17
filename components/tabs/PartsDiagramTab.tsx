'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  partsDiagram?: string;
  manualDiagrams?: Array<{ src: string; caption: string }>;
}

// ---------------------------------------------------------------------------
// SVG helpers (AI-generated fallback diagram)
// ---------------------------------------------------------------------------

function extractSvgString(raw: string): string {
  const match = raw.match(/```(?:svg|xml)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : raw.trim();
}

function sanitizeSvg(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/\b(href|xlink:href)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '')
    .replace(/<use[^>]+href\s*=\s*["'][^#"][^"']*["'][^>]*\/?>/gi, '')
    .replace(/<image[^>]+href\s*=\s*["'](?!data:)[^"']*["'][^>]*\/?>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/@import\s+[^;]+;?/gi, '');
}

function prepareSvg(raw: string): string {
  let svg = sanitizeSvg(raw);
  if (!svg.includes('fill="white"') && !svg.includes("fill='white'") && !svg.includes('fill="#fff')) {
    svg = svg.replace(/(<svg[^>]*>)/, '$1<rect width="100%" height="100%" fill="white"/>');
  }
  svg = svg.replace(/(<svg[^>]*)\bwidth\s*=\s*["']\d[^"']*["']/i, '$1');
  svg = svg.replace(/(<svg[^>]*)\bheight\s*=\s*["']\d[^"']*["']/i, '$1');
  svg = svg.replace(/(<svg[^>]*)\bwidth\s*=\s*["'][^"']*["']/i, '$1');
  svg = svg.replace(/(<svg[^>]*)\bheight\s*=\s*["'][^"']*["']/i, '$1');
  svg = svg.replace(
    /(<svg\b)/i,
    '<svg style="display:block;width:100%;height:100%;" preserveAspectRatio="xMidYMid meet"'
  );
  return svg;
}

function processSvg(raw: string): { svg: string; error: string | null } {
  const extracted = extractSvgString(raw);
  if (!extracted.includes('<svg')) return { svg: '', error: 'The generated diagram does not appear to be valid SVG.' };
  if (!extracted.includes('xmlns=')) return { svg: '', error: 'The generated SVG is missing the required xmlns attribute.' };
  return { svg: prepareSvg(extracted), error: null };
}

// ---------------------------------------------------------------------------
// OEM diagram lightbox
// ---------------------------------------------------------------------------

function DiagramLightbox({ src, caption, onClose }: { src: string; caption: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-inverse-surface/80 z-50 flex items-center justify-center p-4 cursor-zoom-out"
      onClick={onClose}
    >
      <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={caption} className="w-full rounded-lg shadow-2xl bg-white" />
        {caption && (
          <p className="mt-2 text-center text-label-caps text-inverse-on-surface text-xs">{caption}</p>
        )}
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 bg-surface-container-lowest text-on-surface rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-lg hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PartsDiagramTab({ partsDiagram, manualDiagrams }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  const [activeSection, setActiveSection] = useState<'oem' | 'ai'>(
    manualDiagrams && manualDiagrams.length > 0 ? 'oem' : 'ai'
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => Math.min(Math.max(s - e.deltaY * 0.001, 0.3), 5));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const hasOem = manualDiagrams && manualDiagrams.length > 0;
  const hasAi = !!partsDiagram;

  if (!hasOem && !hasAi) {
    return (
      <div className="text-center py-10 text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl mb-2 block text-outline">schema</span>
        <p className="text-sm uppercase font-bold text-outline">No parts diagram available for this video.</p>
      </div>
    );
  }

  // ── Section toggle (OEM / AI) ──────────────────────────────────────────
  const tabs = [
    hasOem && { id: 'oem' as const, label: `OEM DIAGRAMS (${manualDiagrams!.length})` },
    hasAi  && { id: 'ai'  as const, label: 'AI SCHEMATIC' },
  ].filter(Boolean) as Array<{ id: 'oem' | 'ai'; label: string }>;

  // ── AI SVG section ────────────────────────────────────────────────────
  function handlePointerDown(e: React.PointerEvent) {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging.current) return;
    setTranslate({ x: dragStart.current.tx + (e.clientX - dragStart.current.x), y: dragStart.current.ty + (e.clientY - dragStart.current.y) });
  }
  function handlePointerUp(e: React.PointerEvent) {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  const svgResult = hasAi ? processSvg(partsDiagram!) : { svg: '', error: null };

  return (
    <div className="space-y-4">
      {/* Section toggle */}
      {tabs.length > 1 && (
        <div className="flex rounded border border-surface-container-highest overflow-hidden w-fit print:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`px-4 py-2 text-label-caps text-xs font-bold transition-colors ${
                activeSection === tab.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* OEM diagrams grid */}
      {activeSection === 'oem' && hasOem && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary text-sm">verified</span>
            <p className="text-label-caps text-on-surface-variant text-[10px] uppercase">
              OEM service manual diagrams from Lemon Manuals — click to enlarge
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {manualDiagrams!.map((diagram, i) => (
              <button
                key={i}
                onClick={() => setLightbox(diagram)}
                className="group relative bg-white border border-surface-container-highest rounded-lg overflow-hidden hover:border-primary transition-colors cursor-zoom-in text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={diagram.src}
                  alt={diagram.caption}
                  className="w-full object-contain bg-white"
                  style={{ maxHeight: 180 }}
                />
                <div className="px-2 py-1.5 border-t border-surface-container-highest bg-surface-container-low">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase leading-tight line-clamp-2">
                    {diagram.caption}
                  </p>
                </div>
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl drop-shadow">zoom_in</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* AI SVG section */}
      {activeSection === 'ai' && hasAi && (
        <>
          {svgResult.error ? (
            <div className="flex gap-3 p-4 bg-error/5 border border-error/20 rounded-lg text-error">
              <span className="material-symbols-outlined shrink-0">error</span>
              <div>
                <p className="text-label-caps font-bold mb-1">Diagram rendering error</p>
                <p className="text-xs text-on-surface-variant">{svgResult.error}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 print:hidden">
                <span className="text-label-caps text-outline text-[10px]">SCROLL TO ZOOM · DRAG TO PAN</span>
                <div className="flex items-center gap-1 ml-auto">
                  <button onClick={() => setScale((s) => Math.min(s + 0.2, 5))}
                    className="px-2 py-1 text-sm bg-surface-container-low hover:bg-surface-container rounded border border-surface-container-highest font-mono leading-none">+</button>
                  <button onClick={() => setScale((s) => Math.max(s - 0.2, 0.3))}
                    className="px-2 py-1 text-sm bg-surface-container-low hover:bg-surface-container rounded border border-surface-container-highest font-mono leading-none">−</button>
                  <button onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }}
                    className="px-2 py-1 text-label-caps text-xs bg-surface-container-low hover:bg-surface-container rounded border border-surface-container-highest">RESET</button>
                  <a href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgResult.svg)}`}
                    download="parts-diagram.svg"
                    className="px-2 py-1 text-label-caps text-xs bg-primary-fixed text-primary hover:bg-primary-fixed-dim rounded border border-primary/20">
                    DOWNLOAD SVG
                  </a>
                </div>
              </div>
              <div
                ref={containerRef}
                className="relative rounded-lg border border-surface-container-highest bg-white cursor-grab active:cursor-grabbing touch-none select-none overflow-hidden"
                style={{ aspectRatio: '4 / 3', minHeight: 320 }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div
                    style={{ width: '100%', height: '100%', transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`, transformOrigin: 'center center', pointerEvents: 'none' }}
                    dangerouslySetInnerHTML={{ __html: svgResult.svg }}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightbox && <DiagramLightbox src={lightbox.src} caption={lightbox.caption} onClose={() => setLightbox(null)} />}
    </div>
  );
}
