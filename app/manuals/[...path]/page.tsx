import Link from 'next/link';
import {
  fetchMakeYears,
  fetchYearModels,
  fetchModelSections,
  fetchPageContent,
  buildLemonUrl,
  LEMON_BASE,
  type SectionLink,
} from '@/lib/lemon-browser';

interface Props {
  params: Promise<{ path: string[] }>;
}

// ---------------------------------------------------------------------------
// Breadcrumb helpers
// ---------------------------------------------------------------------------

function Breadcrumbs({ segments }: { segments: string[] }) {
  const crumbs: Array<{ label: string; href: string }> = [
    { label: 'Manuals', href: '/manuals' },
    ...segments.map((seg, i) => ({
      label: seg,
      href: '/manuals/' + segments.slice(0, i + 1).map(encodeURIComponent).join('/'),
    })),
  ];
  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs text-on-surface-variant mb-6 print:hidden">
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1">
          {i < crumbs.length - 1 ? (
            <Link href={c.href} className="hover:text-primary transition-colors font-bold uppercase tracking-tight truncate max-w-[180px]">
              {c.label}
            </Link>
          ) : (
            <span className="text-on-surface font-bold uppercase tracking-tight truncate max-w-[240px]">{c.label}</span>
          )}
          {i < crumbs.length - 1 && <span className="text-outline">›</span>}
        </span>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Empty / error state
// ---------------------------------------------------------------------------

function Empty({ message }: { message: string }) {
  return (
    <div className="bg-surface-container-lowest border border-surface-container-highest rounded-lg p-8 text-center shadow-ambient">
      <span className="material-symbols-outlined text-outline text-4xl mb-3 block">search_off</span>
      <p className="text-sm text-on-surface-variant">{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Level 1 — Year browser for a make
// ---------------------------------------------------------------------------

async function YearBrowser({ make }: { make: string }) {
  const years = await fetchMakeYears(make);
  if (years.length === 0) {
    return <Empty message={`No years found for ${make}. The make may not have manuals available on lemon-manuals.la.`} />;
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
      {years.map(({ year }) => (
        <Link
          key={year}
          href={`/manuals/${encodeURIComponent(make)}/${year}`}
          className="bg-surface-container-lowest border border-surface-container-highest rounded-lg p-4 shadow-ambient
                     hover:bg-surface-container-low hover:border-primary hover:text-primary
                     transition-colors text-center group"
        >
          <span className="text-sm font-bold uppercase tracking-tight text-on-surface group-hover:text-primary transition-colors">
            {year}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Level 2 — Model browser for a make + year
// ---------------------------------------------------------------------------

async function ModelBrowser({ make, year }: { make: string; year: string }) {
  const models = await fetchYearModels(make, year);
  if (models.length === 0) {
    return <Empty message={`No models found for ${make} ${year}.`} />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {models.map(({ name, url: _url }) => (
        <Link
          key={name}
          href={`/manuals/${encodeURIComponent(make)}/${year}/${encodeURIComponent(name)}`}
          className="bg-surface-container-lowest border border-surface-container-highest rounded-lg p-4 shadow-ambient
                     hover:bg-surface-container-low hover:border-primary
                     transition-colors flex items-center gap-3 group"
        >
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-base transition-colors flex-shrink-0">
            directions_car
          </span>
          <span className="text-xs font-bold uppercase tracking-tight text-on-surface group-hover:text-primary transition-colors">
            {name}
          </span>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Level 3 — Section browser for a vehicle
// ---------------------------------------------------------------------------

function groupSections(sections: SectionLink[]) {
  const top = sections.filter((s) => s.depth === 1);
  const sub = sections.filter((s) => s.depth > 1);
  // Group sub-sections under their top-level parent
  const grouped = new Map<string, SectionLink[]>();
  for (const t of top) grouped.set(t.name, []);
  for (const s of sub) {
    const parentName = s.url
      .split('/')
      .filter(Boolean)
      .slice(0, -1)
      .map((p) => decodeURIComponent(p))
      .pop() ?? '';
    const bucket = grouped.get(parentName);
    if (bucket) bucket.push(s);
    else grouped.set(s.name, []);
  }
  return grouped;
}

async function SectionBrowser({ segments }: { segments: string[] }) {
  const vehicleUrl = buildLemonUrl(segments);
  const sections = await fetchModelSections(vehicleUrl);
  if (sections.length === 0) {
    return (
      <div className="space-y-4">
        <Empty message="No sections found. The vehicle manual may not be available." />
        <div className="text-center">
          <a
            href={vehicleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded border border-primary text-primary hover:bg-primary hover:text-on-primary transition-colors"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            Open on lemon-manuals.la
          </a>
        </div>
      </div>
    );
  }

  const make = segments[0];
  const year = segments[1];
  const model = segments[2];

  const grouped = groupSections(sections);

  return (
    <div className="space-y-6">
      {/* Vehicle header links */}
      <div className="flex flex-wrap gap-2">
        <a
          href={vehicleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
        >
          <span className="material-symbols-outlined text-sm">open_in_new</span>
          lemon-manuals.la
        </a>
        <a
          href={`${vehicleUrl}Labor%20Times/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded border border-surface-container-highest bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
        >
          <span className="material-symbols-outlined text-sm">schedule</span>
          Labor Times
        </a>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...grouped.entries()].map(([groupName, children]) => (
          <div key={groupName} className="bg-surface-container-lowest border border-surface-container-highest rounded-lg shadow-ambient overflow-hidden">
            <Link
              href={`/manuals/${encodeURIComponent(make)}/${year}/${encodeURIComponent(model)}/${encodeURIComponent(groupName)}`}
              className="flex items-center gap-3 px-4 py-3 bg-surface-container-low hover:bg-primary hover:text-on-primary transition-colors group"
            >
              <span className="material-symbols-outlined text-base text-primary group-hover:text-on-primary transition-colors">article</span>
              <span className="text-xs font-bold uppercase tracking-tight">{groupName}</span>
            </Link>
            {children.length > 0 && (
              <div className="divide-y divide-surface-container-highest">
                {children.slice(0, 6).map((child) => {
                  const childSegments = child.url
                    .replace(LEMON_BASE + '/', '')
                    .replace(/\/$/, '')
                    .split('/')
                    .map(decodeURIComponent);
                  const href = '/manuals/' + childSegments.map(encodeURIComponent).join('/');
                  return (
                    <Link
                      key={child.url}
                      href={href}
                      className="block px-4 py-2 text-xs text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors pl-10"
                    >
                      {child.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Level 4+ — Content viewer
// ---------------------------------------------------------------------------

async function ContentViewer({ segments }: { segments: string[] }) {
  const url = buildLemonUrl(segments);
  const content = await fetchPageContent(url);

  return (
    <div className="space-y-6">
      {/* Open on lemon-manuals.la */}
      <div className="flex justify-end print:hidden">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded border border-surface-container-highest text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
        >
          <span className="material-symbols-outlined text-sm">open_in_new</span>
          Open on lemon-manuals.la
        </a>
      </div>

      {/* Sub-sections */}
      {content.subSections.length > 0 && (
        <div>
          <p className="text-[10px] font-bold tracking-widest text-primary uppercase mb-3">SECTIONS</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {content.subSections.map(({ name, url: subUrl }) => {
              const subSegments = subUrl
                .replace(LEMON_BASE + '/', '')
                .replace(/\/$/, '')
                .split('/')
                .map(decodeURIComponent);
              const href = '/manuals/' + subSegments.map(encodeURIComponent).join('/');
              return (
                <Link
                  key={subUrl}
                  href={href}
                  className="bg-surface-container-lowest border border-surface-container-highest rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-tight text-on-surface hover:border-primary hover:text-primary transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">article</span>
                  {name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* OEM diagrams */}
      {content.images.length > 0 && (
        <div>
          <p className="text-[10px] font-bold tracking-widest text-primary uppercase mb-3">OEM DIAGRAMS</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {content.images.map(({ url: imgUrl, alt }) => (
              <div key={imgUrl} className="bg-surface-container-lowest border border-surface-container-highest rounded-lg overflow-hidden shadow-ambient">
                <a href={imgUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt={alt}
                    className="w-full object-contain max-h-80 hover:opacity-90 transition-opacity"
                    loading="lazy"
                  />
                </a>
                {alt && (
                  <p className="px-3 py-2 text-xs text-on-surface-variant border-t border-surface-container-highest">
                    {alt}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual text content */}
      {content.text && (
        <div>
          <p className="text-[10px] font-bold tracking-widest text-primary uppercase mb-3">MANUAL CONTENT</p>
          <div className="bg-surface-container-lowest border border-surface-container-highest rounded-lg p-6 shadow-ambient">
            <pre className="text-xs text-on-surface-variant whitespace-pre-wrap font-mono leading-relaxed">
              {content.text}
            </pre>
          </div>
        </div>
      )}

      {!content.text && content.images.length === 0 && content.subSections.length === 0 && (
        <Empty message="No content found for this page. Try opening it directly on lemon-manuals.la." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page entry point
// ---------------------------------------------------------------------------

export default async function ManualBrowserPage({ params }: Props) {
  const { path } = await params;
  // path segments are URL-decoded by Next.js automatically
  const segments = path.map(decodeURIComponent);
  const [make, year, model] = segments;
  const level = segments.length;

  let title = 'OEM Service Manuals';
  let subtitle = '';
  if (level >= 1) { title = make; subtitle = 'Select a model year'; }
  if (level >= 2) { title = `${make} ${year}`; subtitle = 'Select a model variant'; }
  if (level >= 3) { title = model; subtitle = `${make} ${year} — Repair Sections`; }
  if (level >= 4) { title = segments[segments.length - 1]; subtitle = segments.slice(0, -1).join(' › '); }

  return (
    <>
      <Breadcrumbs segments={segments} />

      <div className="mb-6 border-l-4 border-primary pl-6">
        <p className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">OEM SERVICE MANUAL</p>
        <h1 className="text-2xl font-bold text-on-surface uppercase tracking-tight mb-1">{title}</h1>
        {subtitle && <p className="text-sm text-on-surface-variant">{subtitle}</p>}
      </div>

      {level === 1 && <YearBrowser make={make} />}
      {level === 2 && <ModelBrowser make={make} year={year} />}
      {level === 3 && <SectionBrowser segments={segments} />}
      {level >= 4 && <ContentViewer segments={segments} />}
    </>
  );
}
