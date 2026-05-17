import Link from 'next/link';
import { KNOWN_MAKES } from '@/lib/web-sources';

export const metadata = { title: 'OEM Service Manuals — Repair Buddy' };

export default function ManualsPage() {
  return (
    <>
      <div className="mb-8 border-l-4 border-primary pl-6">
        <p className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">SHIFT TERMINAL V2.0</p>
        <h1 className="text-3xl font-bold text-on-surface uppercase tracking-tight mb-1">OEM Service Manuals</h1>
        <p className="text-sm text-on-surface-variant">
          Browse factory service manuals sourced from{' '}
          <span className="text-primary font-bold">lemon-manuals.la</span>. Select a make to get started.
        </p>
      </div>

      <div className="mb-6 bg-surface-container-lowest border border-surface-container-highest rounded-lg p-4 flex items-start gap-3 shadow-ambient">
        <span className="material-symbols-outlined text-primary text-xl mt-0.5">info</span>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          These are OEM service manual contents for DIY reference. Content is fetched live from{' '}
          <span className="font-bold text-on-surface">lemon-manuals.la</span>. Torque specs, fluid capacities,
          and wiring diagrams are vehicle-specific — always verify against your exact trim level.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {KNOWN_MAKES.map((make) => (
          <Link
            key={make}
            href={`/manuals/${encodeURIComponent(make)}`}
            className="bg-surface-container-lowest border border-surface-container-highest rounded-lg p-4 shadow-ambient
                       hover:bg-surface-container-low hover:border-primary hover:text-primary
                       transition-colors flex items-center gap-2 group"
          >
            <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-base transition-colors">
              directions_car
            </span>
            <span className="text-xs font-bold uppercase tracking-tight text-on-surface group-hover:text-primary transition-colors">
              {make}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
