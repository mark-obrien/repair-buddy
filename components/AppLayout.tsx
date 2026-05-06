'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GarageModal } from '@/components/GarageModal';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [garageOpen, setGarageOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const saved = localStorage.getItem('sidebarOpen');
    if (saved !== null) {
      setIsSidebarOpen(saved === 'true');
    }
  }, []);

  function toggleSidebar() {
    setIsSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('sidebarOpen', String(next));
      return next;
    });
  }

  const navItems = [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', href: '/dashboard' },
    { id: 'guides', icon: 'menu_book', label: 'Guide Library', href: '/guides' },
    { id: 'generator', icon: 'construction', label: 'Generator', href: '/' },
    { id: 'settings', icon: 'settings', label: 'Settings', href: '/settings' },
  ];

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans">
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-surface-container-lowest border-b border-surface-container-highest shadow-ambient print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className="hidden lg:block material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors cursor-pointer mr-2" title="Toggle Sidebar">
            menu
          </button>
          <div className="w-24 h-8 relative flex items-center justify-center overflow-hidden mix-blend-multiply">
            <img src="/logo.jpg" alt="SHIFT" className="absolute w-[200%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest text-primary uppercase">TERMINAL V2.0</p>
            <p className="text-sm font-bold uppercase tracking-tight text-on-surface leading-none">GARAGE PORTAL</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-gutter">
          <div className="bg-surface-container-low flex items-center px-4 py-2 border border-surface-container-highest rounded">
            <span className="material-symbols-outlined text-outline mr-2 text-base">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 text-xs placeholder:text-outline w-56 outline-none tracking-widest uppercase font-bold"
              placeholder="SEARCH GUIDES..."
              type="text"
            />
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setGarageOpen(true)}
              title="My Garage"
              className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors"
            >
              garage
            </button>
            <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors">notifications</span>
            <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer transition-colors">account_circle</span>
          </div>
        </div>
      </header>

      <nav className={`hidden lg:flex flex-col fixed left-0 top-0 h-full border-r border-surface-container-highest z-40 bg-surface-container-lowest pt-20 print:hidden transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className={`mb-8 ${isSidebarOpen ? 'px-6' : 'px-4'}`}>
          <a
            href="/"
            title={!isSidebarOpen ? "New Repair" : undefined}
            className={`w-full bg-primary text-on-primary text-label-caps py-3 mt-2 font-bold rounded shadow-sm hover:bg-primary-container active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center ${isSidebarOpen ? '' : 'px-0'}`}
          >
            {isSidebarOpen ? 'NEW REPAIR' : <span className="material-symbols-outlined">add</span>}
          </a>
        </div>

        <div className="flex flex-col flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === '/' && pathname.startsWith('/g/'));
            return (
              <Link
                key={item.id}
                href={item.href}
                title={!isSidebarOpen ? item.label : undefined}
                className={[
                  'py-4 flex items-center gap-3 border-l-4 transition-all text-label-caps text-sm text-left',
                  isSidebarOpen ? 'px-6' : 'px-0 justify-center',
                  isActive
                    ? 'bg-primary-fixed text-primary border-primary font-bold'
                    : 'text-on-surface-variant border-transparent hover:bg-surface-container-low hover:text-on-surface',
                ].join(' ')}
              >
                <span className="material-symbols-outlined text-base">{item.icon}</span>
                {isSidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        <div className={`p-6 border-t border-surface-container-highest flex flex-col gap-4 ${isSidebarOpen ? '' : 'px-4'}`}>
          <button
            onClick={() => setGarageOpen(true)}
            title={!isSidebarOpen ? "My Garage" : undefined}
            className={`text-on-surface-variant flex items-center ${isSidebarOpen ? 'gap-3 text-left' : 'justify-center'} text-label-caps text-xs hover:text-primary transition-colors w-full`}
          >
            <span className="material-symbols-outlined text-sm">garage</span>
            {isSidebarOpen && <span>MY GARAGE</span>}
          </button>
          <a title={!isSidebarOpen ? "Support" : undefined} className={`text-on-surface-variant flex items-center ${isSidebarOpen ? 'gap-3 text-left' : 'justify-center'} text-label-caps text-xs hover:text-error transition-colors w-full`} href="#">
            <span className="material-symbols-outlined text-sm">help_outline</span>
            {isSidebarOpen && <span>SUPPORT</span>}
          </a>
        </div>
      </nav>

      <main className={`transition-all duration-300 pt-24 px-gutter lg:px-margin pb-xl ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {children}
      </main>

      <GarageModal
        isOpen={garageOpen}
        onClose={() => setGarageOpen(false)}
        onChange={() => window.dispatchEvent(new Event('garageUpdated'))}
      />
    </div>
  );
}
