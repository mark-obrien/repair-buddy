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

interface Props {
  guide: RepairGuide;
}

type TabId = 'overview' | 'parts' | 'tools' | 'torque' | 'steps' | 'warnings' | 'diagram' | 'parts-diagram';

export function GuideResults({ guide }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const toolCount = guide.standardTools.length + guide.specialtyTools.length;

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'parts', label: 'Parts', count: guide.partsNeeded.length },
    { id: 'tools', label: 'Tools', count: toolCount },
    { id: 'torque', label: 'Torque', count: guide.torqueValues.length },
    { id: 'steps', label: 'Steps', count: guide.repairSteps.length },
    { id: 'warnings', label: 'Warnings', count: guide.warnings.length },
    { id: 'parts-diagram', label: 'Parts Diagram' },
    { id: 'diagram', label: 'Process Flow' },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto border-b border-gray-200">
        <nav className="flex min-w-max">
          {tabs.map((tab) => {
            const isEmpty = tab.count === 0;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-orange-500 text-orange-600'
                    : isEmpty
                    ? 'border-transparent text-gray-300 hover:text-gray-400'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.count != null && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? 'bg-orange-100 text-orange-600'
                        : isEmpty
                        ? 'bg-gray-100 text-gray-300'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-5">
        {activeTab === 'overview' && <OverviewTab guide={guide} />}
        {activeTab === 'parts' && <PartsTab parts={guide.partsNeeded} />}
        {activeTab === 'tools' && (
          <ToolsTab standardTools={guide.standardTools} specialtyTools={guide.specialtyTools} />
        )}
        {activeTab === 'torque' && <TorqueTab torqueValues={guide.torqueValues} />}
        {activeTab === 'steps' && <StepsTab steps={guide.repairSteps} />}
        {activeTab === 'warnings' && <WarningsTab warnings={guide.warnings} />}
        {activeTab === 'parts-diagram' && <PartsDiagramTab partsDiagram={guide.partsDiagram} />}
        {activeTab === 'diagram' && <DiagramTab diagram={guide.diagram} />}
      </div>
    </div>
  );
}
