import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCachedGuide } from '@/lib/cache';
import { DEFAULT_PROVIDER, DEFAULT_MODEL, getProviderConfig } from '@/lib/providers';
import { GuideResults } from '@/components/GuideResults';
import { PrintButton } from '@/components/PrintButton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Props {
  params: { videoId: string };
  searchParams: { p?: string; m?: string };
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function SharedGuidePage({ params, searchParams }: Props) {
  const { videoId } = params;
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    notFound();
  }

  const provider = searchParams.p ?? DEFAULT_PROVIDER;
  const model = searchParams.m ?? DEFAULT_MODEL;

  if (!getProviderConfig(provider)) {
    notFound();
  }

  const cached = await getCachedGuide(videoId, provider, model);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <span className="text-3xl">🔧</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Repair Buddy</h1>
              <p className="text-xs text-gray-500">Shared repair guide</p>
            </div>
          </Link>
          <div className="ml-auto">
            <Link
              href="/"
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              ← Generate your own guide
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        {!cached ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Guide not found</h2>
            <p className="text-sm text-gray-600 mb-4">
              This shared guide may have expired or never existed. Cached guides are kept for 7 days.
            </p>
            <Link
              href={`/?url=https://www.youtube.com/watch?v=${videoId}`}
              className="inline-block px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Generate this guide now
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs print:hidden">
              <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full">
                🔗 Shared guide
              </span>
              <span className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full">
                🤖 {cached.provider} / {cached.model}
              </span>
              <span className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full">
                ⏱ Generated {formatRelativeTime(cached.cachedAt)}
              </span>
              <div className="ml-auto">
                <PrintButton />
              </div>
            </div>
            <GuideResults guide={cached.guide} frames={cached.frames ?? []} />
          </>
        )}
      </main>
    </div>
  );
}
