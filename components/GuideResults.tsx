'use client';

import { useState } from 'react';
import type { RepairGuide } from '@/lib/types';
import { OverviewTab } from './tabs/OverviewTab';
import { PartsTab } from './tabs/PartsTab';
import { ToolsTab } from './tabs/ToolsTab';
import { StepsTab } from './tabs/StepsTab';
import { VideoGuideView } from './VideoGuideView';
import { GarageMatchBanner } from './GarageMatchBanner';
import dynamic from 'next/dynamic';

const DiagramTab = dynamic(() => import('./tabs/DiagramTab').then(m => ({ default: m.DiagramTab })), { ssr: false });
const Scene3DTab = dynamic(() => import('./tabs/Scene3DTab').then(m => ({ default: m.Scene3DTab })), { ssr: false });

type TabId = 'watch' | 'overview' | 'parts' | 'tools' | 'steps' | '3d';

interface Props {
  guide: RepairGuide;
  frames?: string[];
  provider?: string;
  model?: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'watch', label: 'WATCH' },
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'parts', label: 'PARTS' },
  { id: 'tools', label: 'TOOLS' },
  { id: 'steps', label: 'STEPS' },
  { id: '3d', label: '3D VIEW' },
];

function TorqueModule({ torqueValues }: { torqueValues: RepairGuide['torqueValues'] }) {
  const [unit, setUnit] = useState<'ftlb' | 'nm'>('ftlb');
  if (!torqueValues?.length) return null;

  function convert(val: string, currentUnit: string): string {
    const n = parseFloat(val);
    if (isNaN(n)) return val;
    if (unit === 'nm' && currentUnit.toLowerCase().includes('ft')) return (n * 1.356).toFixed(1);
    if (unit === 'ftlb' && currentUnit.toLowerCase().includes('n')) return (n / 1.356).toFixed(1);
    return val;
  }

  return (
    <section className="bg-surface-container-lowest border-2 border-primary overflow-hidden rounded-lg shadow-md">
      <div className="bg-primary px-4 py-2 flex justify-between items-center">
        <span className="font-bold text-on-primary text-[10px] uppercase tracking-widest">Torque Specifications</span>
        <div className="flex bg-on-primary/10 rounded-lg p-0.5 border border-on-primary/20">
          <button onClick={() => setUnit('ftlb')} className={`px-2 py-0.5 text-[9px] font-bold rounded transition-colors ${unit === 'ftlb' ? 'bg-on-primary text-primary' : 'text-on-primary opacity-70'}`}>LB-FT</button>
          <button onClick={() => setUnit('nm')} className={`px-2 py-0.5 text-[9px] font-bold rounded transition-colors ${unit === 'nm' ? 'bg-on-primary text-primary' : 'text-on-primary opacity-70'}`}>NM</button>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {torqueValues.map((t, i) => (
          <div key={i} className={`flex justify-between items-center ${i < torqueValues.length - 1 ? 'border-b border-surface-container-highest pb-3' : ''}`}>
            <span className="font-bold text-on-surface-variant text-[10px] uppercase tracking-widest max-w-[55%]">{t.component}</span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono-data text-primary text-xl font-bold">{convert(t.value, t.unit)}</span>
              <span className="text-[9px] text-outline uppercase font-bold">{unit === 'nm' ? 'nm' : 'ft-lb'}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WarningsModule({ warnings }: { warnings: string[] }) {
  if (!warnings?.length) return null;
  return (
    <section className="bg-error/5 border border-error/20 p-4 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 text-error mb-3">
        <span className="material-symbols-outlined text-xl">error</span>
        <h2 className="font-bold text-sm uppercase tracking-widest">SAFETY CRITICAL</h2>
      </div>
      <ul className="space-y-2">
        {warnings.slice(0, 3).map((w, i) => (
          <li key={i} className="text-[11px] text-error uppercase leading-relaxed font-bold">{w}</li>
        ))}
      </ul>
      {warnings.length > 3 && (
        <p className="text-[10px] text-error/60 mt-2 font-bold">+{warnings.length - 3} MORE WARNINGS</p>
      )}
    </section>
  );
}

function ProcessFlowModule({ diagram }: { diagram: string }) {
  if (!diagram) return null;
  return (
    <section className="bg-surface-container-lowest border border-surface-container-highest rounded-lg overflow-hidden shadow-sm">
      <div className="px-4 py-2 border-b border-surface-container-highest bg-surface-container-low flex justify-between items-center">
        <span className="font-bold text-on-surface-variant text-[10px] uppercase tracking-widest">Process Flow</span>
      </div>
      <div className="p-4">
        <DiagramTab diagram={diagram} />
      </div>
    </section>
  );
}

export function GuideResults({ guide, frames = [], provider = 'anthropic', model = 'claude-sonnet-4-6' }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('watch');

  const tabsWithCounts = TABS.map((t) => {
    let count: number | null = null;
    if (t.id === 'parts') count = (guide.partsNeeded?.length ?? 0) + (guide.standardTools?.length ?? 0) + (guide.specialtyTools?.length ?? 0);
    if (t.id === 'tools') count = (guide.standardTools?.length ?? 0) + (guide.specialtyTools?.length ?? 0);
    if (t.id === 'steps') count = guide.repairSteps?.length ?? 0;
    return { ...t, count };
  });

  const hasVideo = !!guide.videoUrl;

  return (
    <div className="space-y-gutter">
      <GarageMatchBanner vehicleInfo={guide.vehicleInfo} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        {/* Left column */}
        <div className="lg:col-span-8 space-y-gutter">
          {/* Tab bar */}
          <div className="flex items-center overflow-x-auto no-scrollbar border-b border-surface-container-highest bg-surface-container-lowest sticky top-16 z-30 shadow-sm rounded-lg">
            {tabsWithCounts.map((tab) => {
              const isActive = tab.id === activeTab;
              if (tab.id === 'watch' && !hasVideo) return null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'flex-none px-5 py-4 font-bold text-[11px] uppercase tracking-widest transition-all whitespace-nowrap',
                    isActive
                      ? 'text-primary border-b-2 border-primary bg-primary-fixed/30'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low border-b-2 border-transparent',
                  ].join(' ')}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded font-bold ${isActive ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div>
            {activeTab === 'watch' && <VideoGuideView guide={guide} frames={frames} />}
            {activeTab === 'overview' && <OverviewTab guide={guide} />}
            {activeTab === 'parts' && <PartsTab parts={guide.partsNeeded} />}
            {activeTab === 'tools' && <ToolsTab standardTools={guide.standardTools} specialtyTools={guide.specialtyTools} />}
            {activeTab === 'steps' && (
              <StepsTab steps={guide.repairSteps} videoUrl={guide.videoUrl} frames={frames} annotations={guide.frameAnnotations} />
            )}
            {activeTab === '3d' && (
              <Scene3DTab guide={guide} frames={frames} provider={provider} model={model} />
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="lg:col-span-4 space-y-gutter lg:sticky lg:top-24">
          <WarningsModule warnings={guide.warnings} />
          <TorqueModule torqueValues={guide.torqueValues} />

          {/* Schematic / 3D preview card */}
          <section className="bg-surface-container-lowest border border-surface-container-highest rounded-lg overflow-hidden shadow-sm cursor-pointer" onClick={() => setActiveTab('3d')}>
            <div className="px-4 py-2 border-b border-surface-container-highest flex justify-between items-center bg-surface-container-low">
              <span className="font-bold text-on-surface-variant text-[10px] uppercase tracking-widest">3D Schematic</span>
              <span className="material-symbols-outlined text-outline text-sm hover:text-primary">fullscreen</span>
            </div>
            <div className="p-4">
              <div className="aspect-square bg-surface-container border border-surface-container-highest flex flex-col items-center justify-center rounded-lg gap-2">
                <span className="material-symbols-outlined text-3xl text-outline">view_in_ar</span>
                <p className="font-bold text-outline text-[9px] tracking-widest text-center uppercase">Click to open<br/>3D Exploded View</p>
              </div>
            </div>
          </section>

          {/* Process flow */}
          {guide.diagram && <ProcessFlowModule diagram={guide.diagram} />}
        </aside>
      </div>

      {/* Print view: every section rendered sequentially */}
      <div className="print-view hidden print:block space-y-8">
        <section>
          <h2 className="text-xl font-bold mb-3 print:text-black">Overview</h2>
          <OverviewTab guide={guide} />
        </section>
        {guide.warnings.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="text-xl font-bold mb-3 print:text-black">Warnings</h2>
            <ul className="space-y-2">
              {guide.warnings.map((w, i) => (
                <li key={i} className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">{w}</li>
              ))}
            </ul>
          </section>
        )}
        <section className="break-inside-avoid">
          <h2 className="text-xl font-bold mb-3 print:text-black">Parts</h2>
          <PartsTab parts={guide.partsNeeded} />
        </section>
        <section className="break-inside-avoid">
          <h2 className="text-xl font-bold mb-3 print:text-black">Tools</h2>
          <ToolsTab standardTools={guide.standardTools} specialtyTools={guide.specialtyTools} />
        </section>
        {guide.torqueValues.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="text-xl font-bold mb-3 print:text-black">Torque Specifications</h2>
            <TorqueModule torqueValues={guide.torqueValues} />
          </section>
        )}
        <section>
          <h2 className="text-xl font-bold mb-3 print:text-black">Steps</h2>
          <StepsTab steps={guide.repairSteps} videoUrl={guide.videoUrl} frames={frames} annotations={guide.frameAnnotations} />
        </section>
      </div>
    </div>
  );
}
