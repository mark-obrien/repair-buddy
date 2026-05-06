'use client';

import { useState } from 'react';
import type { RepairGuide } from '@/lib/types';
import { OverviewTab } from '@/components/tabs/OverviewTab';
import { PartsTab } from '@/components/tabs/PartsTab';
import { ToolsTab } from '@/components/tabs/ToolsTab';
import { TorqueTab } from '@/components/tabs/TorqueTab';
import { StepsTab } from '@/components/tabs/StepsTab';
import { WarningsTab } from '@/components/tabs/WarningsTab';
import { DiagramTab } from '@/components/tabs/DiagramTab';
import { PartsDiagramTab } from '@/components/tabs/PartsDiagramTab';
import { ShoppingTab } from '@/components/tabs/ShoppingTab';
import { VideoGuideView } from '@/components/VideoGuideView';
import { Scene3DTab } from '@/components/tabs/Scene3DTab';

interface Props {
  guide: RepairGuide;
  frames?: string[];
  provider?: string;
  model?: string;
}

type TabId = 'watch' | 'overview' | 'parts' | 'tools' | 'torque' | 'steps' | 'warnings' | 'diagram' | 'parts-diagram' | 'shopping' | '3d';

export function GuideResults({ guide, frames = [], provider = 'anthropic', model = 'claude-sonnet-4-6' }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [torqueUnit, setTorqueUnit] = useState<'ft-lb' | 'Nm'>('ft-lb');

  const toolCount = guide.standardTools.length + guide.specialtyTools.length;

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'watch', label: 'WATCH' },
    { id: 'parts', label: 'PARTS', count: guide.partsNeeded.length },
    { id: 'tools', label: 'TOOLS', count: toolCount },
    { id: 'torque', label: 'TORQUE', count: guide.torqueValues.length },
    { id: 'steps', label: 'STEPS', count: guide.repairSteps.length },
    { id: 'warnings', label: 'WARNINGS', count: guide.warnings.length },
    { id: 'shopping', label: 'SHOP', count: guide.partsNeeded.length },
    { id: 'parts-diagram', label: 'PARTS DIAGRAM' },
    { id: 'diagram', label: 'FLOW' },
    { id: '3d', label: '3D VIEW' },
  ];

  const criticalWarning = guide.warnings[0];
  const topTorque = guide.torqueValues.slice(0, 3);

  return (
      <div className="guide-printable">

        {/* ── Tab navigation ────────────────────────────────────────────── */}
        <div className="flex items-center overflow-x-auto no-scrollbar border border-surface-container-highest bg-surface-container-lowest rounded-lg shadow-ambient mb-gutter print:hidden sticky top-16 z-30">
          {tabs.map((tab) => {
            const isEmpty = tab.count === 0;
            const isActive = activeTab === tab.id;
            return (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      'flex-none px-5 py-4 text-label-caps text-xs transition-all whitespace-nowrap flex items-center gap-1.5',
                      isActive
                          ? 'text-primary border-b-2 border-primary bg-primary-fixed/30 font-bold'
                          : isEmpty
                              ? 'text-outline border-b-2 border-transparent'
                              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low border-b-2 border-transparent',
                    ].join(' ')}
                >
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isActive ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                  {tab.count}
                </span>
                  )}
                </button>
            );
          })}
        </div>

        {/* ── 3D tab (full-width, no sidebar) ───────────────────────────── */}
        {activeTab === '3d' && (
            <div className="bg-surface-container-lowest border border-surface-container-highest rounded-lg overflow-hidden shadow-ambient">
              <Scene3DTab guide={guide} frames={frames} provider={provider} model={model} />
            </div>
        )}


        {/* ── Video section (full-width) ─────────────────────────────────── */}
        {activeTab === 'watch' && (
            <div className="bg-surface-container-lowest border border-surface-container-highest rounded-lg overflow-hidden shadow-ambient mb-gutter">
              <div className="bg-surface-container-low px-4 py-2 flex justify-between items-center border-b border-surface-container-highest">
                <span className="text-label-caps text-on-surface-variant text-[11px] uppercase">Watch Video Guide</span>
                <span className="text-primary text-label-caps text-[11px]">VIDEO FEED</span>
              </div>
              <VideoGuideView guide={guide} frames={frames} />
            </div>
        )}

        {/* ── Main grid: 8/4 columns ─────────────────────────────────────── */}
        {activeTab !== 'watch' && activeTab !== '3d' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">

              {/* Left column: primary tab content */}
              <div className="lg:col-span-8 space-y-gutter">

                {/* Caution banner — shown when there are warnings */}
                {guide.warnings.length > 0 && activeTab !== 'warnings' && (
                    <section className="bg-amber-50 border-l-4 border-amber-500 p-4 flex gap-4 rounded-r-lg shadow-ambient print:hidden">
                      <span className="material-symbols-outlined text-amber-600 shrink-0">warning</span>
                      <div>
                        <h3 className="text-label-caps text-amber-700 text-sm font-bold mb-1 uppercase">
                          SAFETY CAUTION
                        </h3>
                        <p className="text-xs text-amber-800/80 leading-relaxed font-medium uppercase">
                          {criticalWarning}
                        </p>
                      </div>
                    </section>
                )}

                {/* Tab content */}
                <div className="bg-surface-container-lowest border border-surface-container-highest rounded-lg overflow-hidden shadow-ambient">
                  {/* Estimated time header bar */}
                  {guide.estimatedTimeMinutes && (
                      <div className="bg-surface-container-low px-4 py-2 border-b border-surface-container-highest flex items-center justify-between">
                        <span className="text-label-caps text-on-surface-variant text-[11px] uppercase">Detailed Procedure</span>
                        <span className="text-label-caps text-outline text-[10px] font-bold uppercase">
                    EST. TIME: {guide.estimatedTimeMinutes} MIN
                  </span>
                      </div>
                  )}

                  <div className="p-5">
                    {/* Screen view: active tab only */}
                    <div className="screen-view">
                      {activeTab === 'overview' && <OverviewTab guide={guide} />}
                      {activeTab === 'parts' && <PartsTab parts={guide.partsNeeded} />}
                      {activeTab === 'tools' && (
                          <ToolsTab standardTools={guide.standardTools} specialtyTools={guide.specialtyTools} />
                      )}
                      {activeTab === 'torque' && <TorqueTab torqueValues={guide.torqueValues} />}
                      {activeTab === 'steps' && (
                          <StepsTab steps={guide.repairSteps} videoUrl={guide.videoUrl} frames={frames} annotations={guide.frameAnnotations} />
                      )}
                      {activeTab === 'warnings' && <WarningsTab warnings={guide.warnings} />}
                      {activeTab === 'shopping' && <ShoppingTab parts={guide.partsNeeded} vehicleInfo={guide.vehicleInfo} />}
                      {activeTab === 'parts-diagram' && <PartsDiagramTab partsDiagram={guide.partsDiagram} />}
                      {activeTab === 'diagram' && <DiagramTab diagram={guide.diagram} />}
                    </div>

                    {/* Print view: all sections */}
                    <div className="print-view hidden print:block space-y-8">
                      <section>
                        <h2 className="text-xl font-bold mb-3 print:text-black">Overview</h2>
                        <OverviewTab guide={guide} />
                      </section>
                      {guide.warnings.length > 0 && (
                          <section className="break-inside-avoid">
                            <h2 className="text-xl font-bold mb-3 print:text-black">Warnings</h2>
                            <WarningsTab warnings={guide.warnings} />
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
                            <TorqueTab torqueValues={guide.torqueValues} />
                          </section>
                      )}
                      <section>
                        <h2 className="text-xl font-bold mb-3 print:text-black">Steps</h2>
                        <StepsTab steps={guide.repairSteps} videoUrl={guide.videoUrl} frames={frames} annotations={guide.frameAnnotations} />
                      </section>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column: sticky utility sidebar */}
              <aside className="lg:col-span-4 space-y-gutter lg:sticky lg:top-24 print:hidden">

                {/* Safety critical module */}
                {guide.warnings.length > 0 && (
                    <section className="bg-error/5 border border-error/20 p-4 rounded-lg shadow-ambient">
                      <div className="flex items-center gap-2 text-error mb-3">
                        <span className="material-symbols-outlined text-xl">error</span>
                        <h2 className="text-label-caps text-sm font-bold uppercase">SAFETY CRITICAL</h2>
                      </div>
                      <ul className="space-y-2">
                        {guide.warnings.slice(0, 2).map((w, i) => (
                            <li key={i} className="text-[11px] text-error uppercase leading-relaxed font-bold">{w}</li>
                        ))}
                      </ul>
                      {guide.warnings.length > 2 && (
                          <button
                              onClick={() => setActiveTab('warnings')}
                              className="mt-3 text-[10px] text-error/70 hover:text-error font-bold uppercase tracking-widest transition-colors"
                          >
                            +{guide.warnings.length - 2} MORE WARNINGS →
                          </button>
                      )}
                    </section>
                )}

                {/* Torque specs module */}
                {topTorque.length > 0 && (
                    <section className="bg-surface-container-lowest border-2 border-primary overflow-hidden rounded-lg shadow-ambient">
                      <div className="bg-primary px-4 py-2.5 flex justify-between items-center">
                  <span className="text-label-caps text-on-primary font-bold text-[10px] uppercase tracking-widest">
                    Torque Specifications
                  </span>
                        <div className="flex bg-on-primary/10 rounded p-0.5 border border-on-primary/20">
                          <button
                              onClick={() => setTorqueUnit('ft-lb')}
                              className={`px-2 py-0.5 text-[9px] font-bold rounded transition-colors ${torqueUnit === 'ft-lb' ? 'bg-on-primary text-primary' : 'text-on-primary opacity-70'}`}
                          >
                            LB-FT
                          </button>
                          <button
                              onClick={() => setTorqueUnit('Nm')}
                              className={`px-2 py-0.5 text-[9px] font-bold rounded transition-colors ${torqueUnit === 'Nm' ? 'bg-on-primary text-primary' : 'text-on-primary opacity-70'}`}
                          >
                            NM
                          </button>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        {topTorque.map((tv, i) => {
                          const isLast = i === topTorque.length - 1;
                          const displayValue = torqueUnit === 'Nm' && tv.unit === 'ft-lbs'
                              ? Math.round(parseFloat(tv.value) * 1.355817948).toString()
                              : torqueUnit === 'ft-lb' && tv.unit === 'Nm'
                                  ? Math.round(parseFloat(tv.value) / 1.355817948).toString()
                                  : tv.value;
                          return (
                              <div key={i} className={`flex justify-between items-center ${!isLast ? 'border-b border-surface-container-highest pb-4' : ''}`}>
                        <span className="text-label-caps text-on-surface-variant text-[10px] font-bold uppercase">
                          {tv.component.toUpperCase()}
                        </span>
                                <div className="flex items-baseline gap-1">
                                  <span className="font-mono text-primary text-xl font-bold">{displayValue}</span>
                                  <span className="text-[9px] text-outline uppercase font-bold">{torqueUnit}</span>
                                </div>
                              </div>
                          );
                        })}
                      </div>
                      {guide.torqueValues.length > 3 && (
                          <div className="px-4 pb-4">
                            <button
                                onClick={() => setActiveTab('torque')}
                                className="w-full text-[10px] text-primary hover:text-primary-container font-bold uppercase tracking-widest transition-colors border border-primary/20 rounded py-2"
                            >
                              VIEW ALL {guide.torqueValues.length} SPECS →
                            </button>
                          </div>
                      )}
                    </section>
                )}

                {/* Process flow checklist */}
                {guide.repairSteps.length > 0 && (
                    <section className="bg-surface-container-lowest border border-surface-container-highest rounded-lg overflow-hidden shadow-ambient">
                      <div className="px-4 py-2.5 border-b border-surface-container-highest bg-surface-container-low">
                  <span className="text-label-caps text-on-surface-variant text-[10px] uppercase tracking-widest font-bold">
                    Process Flow
                  </span>
                      </div>
                      <div className="p-4">
                        <div className="relative pl-6 space-y-4">
                          <div className="absolute left-[3px] top-2 bottom-2 w-px bg-surface-container-highest" />
                          {guide.repairSteps.slice(0, 6).map((step, i) => {
                            const isFirst = i === 0;
                            return (
                                <div key={step.step} className="relative flex items-start gap-3">
                                  <div className={`absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-sm border transition-colors ${
                                      isFirst
                                          ? 'bg-primary border-primary animate-pulse'
                                          : 'bg-surface-container-low border-surface-container-highest'
                                  }`} />
                                  <div className="flex-1">
                                    <p className={`text-[10px] uppercase font-bold tracking-tight ${isFirst ? 'text-primary' : 'text-on-surface-variant'}`}>
                                      {String(step.step).padStart(2, '0')}. {step.title}
                                    </p>
                                    {isFirst && (
                                        <p className="text-[9px] text-outline mt-0.5 font-bold uppercase">IN PROGRESS</p>
                                    )}
                                  </div>
                                </div>
                            );
                          })}
                          {guide.repairSteps.length > 6 && (
                              <p className="text-[9px] text-outline uppercase font-bold pl-0">
                                +{guide.repairSteps.length - 6} MORE STEPS
                              </p>
                          )}
                        </div>
                        <button
                            onClick={() => setActiveTab('steps')}
                            className="mt-4 w-full text-[10px] text-on-surface-variant hover:text-primary font-bold uppercase tracking-widest transition-colors border border-surface-container-highest rounded py-2"
                        >
                          VIEW FULL PROCEDURE →
                        </button>
                      </div>
                    </section>
                )}

                {/* Vehicle info */}
                {!guide.vehicleInfo.isGeneral && (
                    <section className="bg-surface-container-lowest border border-surface-container-highest rounded-lg overflow-hidden shadow-ambient">
                      <div className="px-4 py-2.5 border-b border-surface-container-highest bg-surface-container-low">
                  <span className="text-label-caps text-on-surface-variant text-[10px] uppercase tracking-widest font-bold">
                    Vehicle Applicability
                  </span>
                      </div>
                      <div className="p-4">
                        <p className="font-mono text-on-surface text-sm font-bold">{guide.vehicleInfo.applicability}</p>
                        {guide.vehicleInfo.notes && (
                            <p className="text-[11px] text-on-surface-variant mt-2">{guide.vehicleInfo.notes}</p>
                        )}
                      </div>
                    </section>
                )}
              </aside>
            </div>
        )}
      </div>
  );
}