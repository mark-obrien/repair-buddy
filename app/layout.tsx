import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Repair Buddy — YouTube Repair Guide Generator',
  description:
    'Paste a YouTube repair video URL and instantly get a structured guide with parts, tools, torque specs, and step-by-step instructions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
