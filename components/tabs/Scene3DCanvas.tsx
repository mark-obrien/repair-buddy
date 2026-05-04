'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Scene3D, SceneComponent } from '@/lib/types';

// ---------------------------------------------------------------------------
// Constants
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

const MAT_PROPS: Record<string, { metalness: number; roughness: number }> = {
  primary:    { metalness: 0.3,  roughness: 0.55 },
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
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function createGeometry(comp: SceneComponent): THREE.BufferGeometry {
  const { shape, width: w, height: h, depth: d } = comp;
  const r = w / 2;
  switch (shape) {
    case 'cylinder': return new THREE.CylinderGeometry(r, r, h, 32);
    case 'sphere':   return new THREE.SphereGeometry(r, 32, 32);
    case 'cone':     return new THREE.ConeGeometry(r, h, 32);
    case 'torus':    return new THREE.TorusGeometry(r, Math.min(d / 2, r * 0.35), 16, 48);
    default:         return new THREE.BoxGeometry(w, h, d);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MeshEntry {
  mesh: THREE.Mesh;
  comp: SceneComponent;
  animPos: THREE.Vector3;
}

interface Props {
  scene: Scene3D;
}

export function Scene3DCanvas({ scene }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exploded, setExploded] = useState(true);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Mutable refs — read inside the animation loop without stale closures
  const explodedRef    = useRef(true);
  const selectedIdRef  = useRef<string | null>(null);
  const hoveredIdRef   = useRef<string | null>(null);
  const meshEntriesRef = useRef<MeshEntry[]>([]);

  useEffect(() => { explodedRef.current = exploded; }, [exploded]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Re-run when the scene data changes
  useEffect(() => {
    // Cast once — null guard is below, closures see HTMLCanvasElement not | null
    const canvas = canvasRef.current as HTMLCanvasElement;
    if (!canvas) return;

    // ── Renderer ─────────────────────────────────────────────────────────
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch (e) {
      setWebglError(e instanceof Error ? e.message : 'WebGL not available');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ── Scene + camera ────────────────────────────────────────────────────
    const threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color('#030712');

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(12, 9, 12);

    // ── Lights ────────────────────────────────────────────────────────────
    threeScene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const sun = new THREE.DirectionalLight(0xffffff, 1.3);
    sun.position.set(10, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(1024);
    threeScene.add(sun);

    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-8, 4, -6);
    threeScene.add(fill);

    // ── Floor grid ────────────────────────────────────────────────────────
    const grid = new THREE.GridHelper(30, 30, '#1f2937', '#111827');
    grid.position.y = -0.02;
    threeScene.add(grid);

    // ── Meshes ────────────────────────────────────────────────────────────
    meshEntriesRef.current = [];
    for (const comp of scene.components) {
      const matProps = MAT_PROPS[comp.category] ?? MAT_PROPS.structural;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(comp.color),
        metalness: matProps.metalness,
        roughness: matProps.roughness,
        transparent: comp.category === 'seal',
        opacity: comp.category === 'seal' ? 0.82 : 1,
      });
      const mesh = new THREE.Mesh(createGeometry(comp), mat);
      mesh.position.set(comp.x, comp.y, comp.z);
      mesh.rotation.set(comp.rotX, comp.rotY, comp.rotZ);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.compId = comp.id;
      threeScene.add(mesh);
      meshEntriesRef.current.push({
        mesh,
        comp,
        animPos: new THREE.Vector3(comp.x, comp.y, comp.z),
      });
    }

    // ── Orbit controls ────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, canvas);
    controls.minDistance = 3;
    controls.maxDistance = 50;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // ── Raycaster ─────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function toNDC(e: MouseEvent | PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function onPointerMove(e: PointerEvent) {
      toNDC(e);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshEntriesRef.current.map((m) => m.mesh));
      const id = hits.length > 0 ? (hits[0].object.userData.compId as string) : null;
      if (id !== hoveredIdRef.current) {
        hoveredIdRef.current = id;
        canvas.style.cursor = id ? 'pointer' : 'default';
      }
    }

    function onClick(e: MouseEvent) {
      toNDC(e);
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(meshEntriesRef.current.map((m) => m.mesh));
      if (hits.length > 0) {
        const id = hits[0].object.userData.compId as string;
        setSelectedId((prev) => (prev === id ? null : id));
      }
    }

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('click', onClick);

    // ── Resize ────────────────────────────────────────────────────────────
    function resize() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // ── Animation loop ────────────────────────────────────────────────────
    let frameId = 0;
    function animate() {
      frameId = requestAnimationFrame(animate);
      controls.update();

      const s = explodedRef.current ? 1.0 : 0.4;
      const sel = selectedIdRef.current;
      const hov = hoveredIdRef.current;

      for (const { mesh, comp, animPos } of meshEntriesRef.current) {
        animPos.lerp(new THREE.Vector3(comp.x * s, comp.y * s, comp.z * s), 0.08);
        mesh.position.copy(animPos);

        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (sel === comp.id)      mat.color.set('#ffffff');
        else if (hov === comp.id) mat.color.set(brighten(comp.color));
        else                      mat.color.set(comp.color);
      }

      renderer.render(threeScene, camera);
    }
    animate();

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('click', onClick);
      controls.dispose();
      for (const { mesh } of meshEntriesRef.current) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      threeScene.clear();
      renderer.dispose();
    };
  }, [scene]);

  if (webglError) {
    return (
      <div className="flex items-center justify-center bg-gray-950 text-gray-400 text-sm p-6 text-center" style={{ height: 540 }}>
        <div>
          <p className="font-semibold text-gray-300 mb-1">3D view unavailable</p>
          <p className="text-xs">{webglError}</p>
        </div>
      </div>
    );
  }

  const selected = scene.components.find((c) => c.id === selectedId) ?? null;
  const usedCategories = [...new Set(scene.components.map((c) => c.category))];

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

        {/* Plain Three.js canvas — no custom React renderer */}
        <canvas
          ref={canvasRef}
          className="flex-1 min-w-0 bg-gray-950 block"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Side panel */}
        <div className="w-48 shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden text-sm">

          <div className="flex-1 overflow-y-auto p-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
              Components
            </p>
            {scene.components.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId((prev) => (prev === c.id ? null : c.id))}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors mb-0.5 ${
                  selectedId === c.id ? 'bg-gray-700' : 'hover:bg-gray-800'
                }`}
              >
                <span className="shrink-0 w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} />
                <span className="text-xs text-gray-300 truncate">{c.name}</span>
              </button>
            ))}
          </div>

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
