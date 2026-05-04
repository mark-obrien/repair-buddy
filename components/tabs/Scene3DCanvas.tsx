'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useRef, useState, Component } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { Scene3D, SceneComponent } from '@/lib/types';

// ---------------------------------------------------------------------------
// Material properties per category
// ---------------------------------------------------------------------------

const MAT: Record<string, { metalness: number; roughness: number }> = {
  primary:    { metalness: 0.3, roughness: 0.55 },
  structural: { metalness: 0.65, roughness: 0.45 },
  fastener:   { metalness: 0.85, roughness: 0.2  },
  seal:       { metalness: 0.0,  roughness: 0.9  },
  sensor:     { metalness: 0.15, roughness: 0.65 },
  fluid:      { metalness: 0.5,  roughness: 0.4  },
  rotating:   { metalness: 0.75, roughness: 0.3  },
};

function brighten(hex: string, amt = 0.25): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const clamp = (v: number) => Math.min(255, Math.round(v + amt * 255));
  const r = clamp((n >> 16) & 0xff);
  const g = clamp((n >> 8)  & 0xff);
  const b = clamp(n         & 0xff);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// ---------------------------------------------------------------------------
// Single component mesh + label
// ---------------------------------------------------------------------------

function ComponentMesh({
  comp,
  exploded,
  selected,
  onSelect,
}: {
  comp: SceneComponent;
  exploded: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const animPos = useRef(new THREE.Vector3(comp.x, comp.y, comp.z));
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    const s = exploded ? 1.0 : 0.4;
    const target = new THREE.Vector3(comp.x * s, comp.y * s, comp.z * s);
    animPos.current.lerp(target, 0.08);
    groupRef.current.position.copy(animPos.current);
  });

  const mat = MAT[comp.category] ?? MAT.structural;
  const color = selected ? '#ffffff' : hovered ? brighten(comp.color) : comp.color;
  const { width: w, height: h, depth: d } = comp;
  const r = w / 2;

  return (
    <group
      ref={groupRef}
      position={[comp.x, comp.y, comp.z]}
      rotation={[comp.rotX, comp.rotY, comp.rotZ]}
    >
      <mesh
        castShadow
        receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); onSelect(comp.id); }}
      >
        {comp.shape === 'cylinder' && <cylinderGeometry args={[r, r, h, 32]} />}
        {comp.shape === 'sphere'   && <sphereGeometry   args={[r, 32, 32]} />}
        {comp.shape === 'cone'     && <coneGeometry      args={[r, h, 32]} />}
        {comp.shape === 'torus'    && <torusGeometry     args={[r, Math.min(d / 2, r * 0.35), 16, 48]} />}
        {comp.shape === 'box'      && <boxGeometry       args={[w, h, d]} />}

        <meshStandardMaterial
          color={color}
          metalness={mat.metalness}
          roughness={mat.roughness}
          transparent={comp.category === 'seal'}
          opacity={comp.category === 'seal' ? 0.82 : 1}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Error boundary — catches WebGL / R3F reconciler errors gracefully
// ---------------------------------------------------------------------------

interface EBState { error: Error | null }
class CanvasErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(error: Error): EBState { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-950 text-gray-400 text-sm p-6 text-center">
          <div>
            <p className="font-semibold text-gray-300 mb-1">3D view unavailable</p>
            <p className="text-xs">{this.state.error.message || 'WebGL may not be supported in this browser.'}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Legend category rows (bottom-left overlay)
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  primary:    '#f97316',
  structural: '#94a3b8',
  fastener:   '#ca8a04',
  seal:       '#16a34a',
  sensor:     '#2563eb',
  fluid:      '#0891b2',
  rotating:   '#9333ea',
};

// ---------------------------------------------------------------------------
// Full scene
// ---------------------------------------------------------------------------

interface Props {
  scene: Scene3D;
}

export function Scene3DCanvas({ scene }: Props) {
  const [exploded, setExploded] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = scene.components.find((c) => c.id === selectedId) ?? null;

  // Which categories are actually used
  const usedCategories = [...new Set(scene.components.map((c) => c.category))];

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col" style={{ height: 540 }}>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-gray-900 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-100 truncate flex-1">{scene.title}</h3>
        <button
          onClick={() => setExploded((e) => !e)}
          className={`text-xs px-3 py-1.5 rounded font-semibold transition-colors ${
            exploded
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
        >
          {exploded ? 'Exploded' : 'Assembled'}
        </button>
        <span className="hidden sm:block text-xs text-gray-500">Drag · Scroll · Click</span>
      </div>

      {/* ── Canvas + side panel ─────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Three.js canvas */}
        <div className="flex-1 min-w-0 bg-gray-950">
          <CanvasErrorBoundary>
            <Canvas
              shadows
              camera={{ position: [12, 9, 12], fov: 45 }}
              style={{ width: '100%', height: '100%' }}
            >
              <color attach="background" args={['#030712']} />

              <ambientLight intensity={0.55} />
              <directionalLight position={[10, 14, 8]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]} />
              <directionalLight position={[-8, 4, -6]} intensity={0.35} />

              {scene.components.map((comp) => (
                <ComponentMesh
                  key={comp.id}
                  comp={comp}
                  exploded={exploded}
                  selected={selectedId === comp.id}
                  onSelect={handleSelect}
                />
              ))}

              {/* Floor grid */}
              <gridHelper args={[30, 30, '#1f2937', '#111827']} position={[0, -0.02, 0]} />

              <OrbitControls makeDefault minDistance={3} maxDistance={50} />
            </Canvas>
          </CanvasErrorBoundary>
        </div>

        {/* Side panel: component list + selected info */}
        <div className="w-48 shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden text-sm">

          {/* Component list */}
          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
              Components
            </p>
            {scene.components.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors mb-0.5 ${
                  selectedId === c.id ? 'bg-gray-700' : 'hover:bg-gray-800'
                }`}
              >
                <span
                  className="shrink-0 w-2.5 h-2.5 rounded-sm"
                  style={{ background: c.color }}
                />
                <span className="text-xs text-gray-300 truncate">{c.name}</span>
              </button>
            ))}
          </div>

          {/* Selected component detail */}
          <div className="shrink-0 border-t border-gray-700 p-3">
            {selected ? (
              <>
                <p className="text-xs font-semibold text-orange-400 mb-0.5 truncate">{selected.name}</p>
                <span
                  className="inline-block text-xs px-1.5 py-0.5 rounded mb-2 font-medium"
                  style={{ background: selected.color + '28', color: selected.color }}
                >
                  {selected.category}
                </span>
                {selected.description && (
                  <p className="text-xs text-gray-400 leading-relaxed">{selected.description}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-600">Click a component to inspect</p>
            )}
          </div>

          {/* Category legend */}
          <div className="shrink-0 border-t border-gray-700 p-3 space-y-1">
            {usedCategories.map((cat) => (
              <div key={cat} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CATEGORY_COLORS[cat] }} />
                <span className="text-xs text-gray-500 capitalize">{cat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
