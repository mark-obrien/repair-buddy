'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  partsDiagram?: string;
}

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

function normalizeSvgDimensions(svg: string): string {
  let result = svg;
  if (/(<svg[^>]*)\bwidth\s*=\s*["'][^"']*["']/i.test(result)) {
    result = result.replace(/(<svg[^>]*)\bwidth\s*=\s*["'][^"']*["']/i, '$1width="100%"');
  }
  if (/(<svg[^>]*)\bheight\s*=\s*["'][^"']*["']/i.test(result)) {
    result = result.replace(/(<svg[^>]*)\bheight\s*=\s*["'][^"']*["']/i, '$1height="auto"');
  }
  return result;
}

function processSvg(raw: string): { svg: string; error: string | null } {
  const extracted = extractSvgString(raw);
  if (!extracted.includes('<svg')) {
    return { svg: '', error: 'The generated diagram does not appear to be valid SVG.' };
  }
  if (!extracted.includes('xmlns=')) {
    return { svg: '', error: 'The generated SVG is missing the required xmlns attribute.' };
  }
  const sanitized = sanitizeSvg(extracted);
  const normalized = normalizeSvgDimensions(sanitized);
  return { svg: normalized, error: null };
}

export function PartsDiagramTab({ partsDiagram }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => Math.min(Math.max(s - e.deltaY * 0.001, 0.4), 4));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  if (!partsDiagram) {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-4xl mb-2">🗺️</div>
        <p className="text-sm">No parts diagram was generated for this video.</p>
      </div>
    );
  }

  const { svg, error } = processSvg(partsDiagram);

  if (error) {
    return (
      <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
        <span className="text-lg shrink-0">⚠️</span>
        <div>
          <p className="text-sm font-semibold mb-1">Diagram rendering error</p>
          <p className="text-sm">{error}</p>
          <details className="mt-3">
            <summary className="text-xs cursor-pointer text-red-600 hover:text-red-700">
              Show raw SVG
            </summary>
            <pre className="mt-2 text-xs bg-red-100 rounded p-3 overflow-x-auto whitespace-pre-wrap">
              {partsDiagram}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  function handlePointerDown(e: React.PointerEvent) {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging.current) return;
    setTranslate({
      x: dragStart.current.tx + (e.clientX - dragStart.current.x),
      y: dragStart.current.ty + (e.clientY - dragStart.current.y),
    });
  }

  function handlePointerUp(e: React.PointerEvent) {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function handleReset() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Scroll to zoom · Drag to pan</span>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setScale((s) => Math.min(s + 0.25, 4))}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded font-mono leading-none"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s - 0.25, 0.4))}
            className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded font-mono leading-none"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={handleReset}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
            title="Reset view"
          >
            Reset
          </button>
          <a
            href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
            download="parts-diagram.svg"
            className="px-2 py-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded"
          >
            Download SVG
          </a>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-[520px] overflow-hidden rounded-lg border border-gray-200 bg-gray-50 cursor-grab active:cursor-grabbing touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
