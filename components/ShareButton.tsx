'use client';

import { useState } from 'react';

interface Props {
  videoId: string;
  provider: string;
  model: string;
}

export function ShareButton({ videoId, provider, model }: Props) {
  const [copied, setCopied] = useState(false);

  function buildShareUrl(): string {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams({ p: provider, m: model });
    return `${window.location.origin}/g/${videoId}?${params.toString()}`;
  }

  async function handleCopy() {
    const shareUrl = buildShareUrl();
    if (!shareUrl) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Copy failed:', err);
      window.prompt('Copy this share link:', shareUrl);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
        copied
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
      }`}
      title="Copy a shareable link to this guide"
    >
      {copied ? <>✓ Link copied</> : <>🔗 Share</>}
    </button>
  );
}
