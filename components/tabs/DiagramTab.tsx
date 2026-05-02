'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  diagram: string;
}

export function DiagramTab({ diagram }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!diagram) return;

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            primaryColor: '#fff7ed',
            primaryBorderColor: '#f97316',
            primaryTextColor: '#1c1917',
            lineColor: '#9a3412',
            secondaryColor: '#fef3c7',
            tertiaryColor: '#f0fdf4',
          },
        });

        const id = `diagram-${Date.now()}`;
        const { svg } = await mermaid.render(id, diagram);
        if (ref.current) {
          ref.current.innerHTML = svg;
          setRendered(true);
        }
      } catch (e) {
        console.error('Mermaid render error:', e);
        setError(
          'The process diagram could not be rendered. The diagram syntax generated for this video may be invalid.'
        );
      }
    }

    render();
  }, [diagram]);

  if (!diagram) {
    return (
      <div className="text-center py-10 text-gray-400">
        <div className="text-4xl mb-2">📊</div>
        <p className="text-sm">No process diagram was generated for this video.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
        <span className="text-lg shrink-0">⚠️</span>
        <div>
          <p className="text-sm font-semibold mb-1">Diagram rendering error</p>
          <p className="text-sm">{error}</p>
          <details className="mt-3">
            <summary className="text-xs cursor-pointer text-red-600 hover:text-red-700">
              Show raw diagram syntax
            </summary>
            <pre className="mt-2 text-xs bg-red-100 rounded p-3 overflow-x-auto whitespace-pre-wrap">
              {diagram}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div>
      {!rendered && (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
          <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          Rendering diagram…
        </div>
      )}
      <div
        ref={ref}
        className="flex justify-center overflow-x-auto"
        style={{ display: rendered ? 'flex' : 'none' }}
      />
    </div>
  );
}
