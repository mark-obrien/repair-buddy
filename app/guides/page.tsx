'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LibraryGuide {
  videoId: string;
  provider: string;
  model: string;
  cachedAt: number;
  title: string;
  thumbnailUrl: string;
  difficulty?: string;
  summary: string;
  vehicleApplicability: string;
}

export default function GuidesPage() {
  const [guides, setGuides] = useState<LibraryGuide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/guides')
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setGuides(data.guides || []);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load guide library.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 border-l-4 border-primary pl-6">
        <h1 className="text-3xl font-bold text-on-surface uppercase tracking-tight mb-2">
          Guide Library
        </h1>
        <p className="text-on-surface-variant">
          Your generated and saved repair guides.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">autorenew</span>
        </div>
      ) : error ? (
        <div className="bg-error-container text-on-error-container p-4 rounded-lg flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="text-sm font-bold">{error}</p>
        </div>
      ) : guides.length === 0 ? (
        <div className="bg-surface-container-lowest border border-surface-container-highest p-12 rounded-lg shadow-ambient text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-4">menu_book</span>
          <h2 className="text-xl font-bold text-on-surface mb-2">No guides found</h2>
          <p className="text-on-surface-variant mb-6">You haven't generated any repair guides yet.</p>
          <Link href="/" className="bg-primary text-on-primary px-6 py-2 rounded text-label-caps uppercase tracking-widest font-bold hover:bg-primary-container transition-colors inline-block">
            Generate a Guide
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
          {guides.map((guide) => {
            const url = `/g/${guide.videoId}?p=${guide.provider}&m=${guide.model}`;
            return (
              <Link key={`${guide.videoId}-${guide.provider}-${guide.model}`} href={url} className="group block">
                <div className="bg-surface-container-lowest border border-surface-container-highest rounded-lg overflow-hidden shadow-ambient hover:shadow-md transition-shadow h-full flex flex-col">
                  {/* Thumbnail */}
                  <div className="aspect-video w-full bg-surface-container-highest relative overflow-hidden border-b border-surface-container-highest">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={guide.thumbnailUrl} alt={guide.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                    {guide.difficulty && (
                      <div className="absolute top-2 right-2">
                        {guide.difficulty === 'expert' || guide.difficulty === 'advanced' ? (
                          <span className="bg-error text-on-error text-label-caps px-2 py-1 text-[10px] rounded-sm uppercase shadow-sm">
                            {guide.difficulty === 'expert' ? 'CRITICAL REPAIR' : 'ADVANCED REPAIR'}
                          </span>
                        ) : (
                          <span className="bg-surface-container-high/90 backdrop-blur-sm text-on-surface-variant text-label-caps px-2 py-1 text-[10px] rounded-sm uppercase shadow-sm">
                            {guide.difficulty}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-on-surface line-clamp-2 leading-tight mb-2 group-hover:text-primary transition-colors">
                      {guide.title}
                    </h3>
                    <div className="flex items-center gap-1.5 mb-3 text-xs text-on-surface-variant font-medium">
                      <span className="material-symbols-outlined text-[14px]">directions_car</span>
                      <span className="truncate">{guide.vehicleApplicability}</span>
                    </div>
                    <p className="text-sm text-on-surface-variant line-clamp-2 mb-4 flex-1">
                      {guide.summary}
                    </p>
                    
                    <div className="flex items-center justify-between text-[10px] font-bold text-outline uppercase tracking-wider pt-3 border-t border-surface-container-highest mt-auto">
                      <span>{new Date(guide.cachedAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1 text-primary group-hover:translate-x-1 transition-transform">
                        VIEW GUIDE <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
