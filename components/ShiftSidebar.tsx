'use client';
interface Props { activeSection?: string; onNewRepair?: () => void; }
export function ShiftSidebar({ activeSection = 'generator', onNewRepair }: Props) {
  const navItems = [
    { id: 'generator', label: 'Guide Generator', icon: 'construction', href: '/' },
    { id: 'settings', label: 'Settings', icon: 'settings', href: '#' },
  ];
  return (
    <nav className="hidden lg:flex flex-col fixed left-0 top-0 h-full border-r border-surface-container-highest z-40 bg-surface-container-lowest w-64 pt-20">
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 border border-primary/20 bg-primary-fixed flex items-center justify-center rounded-lg">
            <span className="material-symbols-outlined text-primary">construction</span>
          </div>
          <div>
            <p className="text-primary font-bold uppercase text-[10px] tracking-widest">SHIFT TERMINAL V2.0</p>
            <p className="font-bold uppercase tracking-tight text-on-surface text-sm">REPAIR PORTAL</p>
          </div>
        </div>
        <button
          onClick={onNewRepair}
          className="w-full bg-primary text-on-primary font-bold uppercase tracking-widest py-3 mt-4 text-xs rounded-lg shadow-sm hover:bg-primary-container active:scale-95 transition-all"
        >
          NEW REPAIR
        </button>
      </div>
      <div className="flex flex-col flex-1">
        {navItems.map((item) => {
          const isActive = item.id === activeSection;
          return (
            <a
              key={item.id}
              href={item.href}
              className={[
                'px-6 py-4 flex items-center gap-3 border-l-4 transition-all font-bold uppercase text-xs tracking-widest',
                isActive
                  ? 'bg-primary-fixed text-primary border-primary'
                  : 'text-on-surface-variant border-transparent hover:bg-surface-container-low hover:text-on-surface',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </a>
          );
        })}
      </div>
      <div className="p-6 border-t border-surface-container-highest">
        <a href="#" className="text-on-surface-variant flex items-center gap-3 mb-4 font-bold uppercase text-[10px] tracking-widest hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-sm">help_outline</span> SUPPORT
        </a>
        <a href="#" className="text-on-surface-variant flex items-center gap-3 font-bold uppercase text-[10px] tracking-widest hover:text-error transition-colors">
          <span className="material-symbols-outlined text-sm">logout</span> LOGOUT
        </a>
      </div>
    </nav>
  );
}
