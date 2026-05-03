'use client';

import { useEffect, useState } from 'react';
import type { SavedVehicle } from '@/lib/types';
import { getVehicles, addVehicle, removeVehicle } from '@/lib/garage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onChange?: () => void;
}

export function GarageModal({ isOpen, onClose, onChange }: Props) {
  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);
  const [form, setForm] = useState({ make: '', model: '', year: '', trim: '', nickname: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (isOpen) setVehicles(getVehicles());
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const year = parseInt(form.year, 10);
    if (!form.make.trim() || !form.model.trim() || isNaN(year)) return;

    addVehicle({
      make: form.make.trim(),
      model: form.model.trim(),
      year,
      trim: form.trim.trim() || undefined,
      nickname: form.nickname.trim() || undefined,
    });
    setVehicles(getVehicles());
    setForm({ make: '', model: '', year: '', trim: '', nickname: '' });
    setShowAddForm(false);
    onChange?.();
  }

  function handleRemove(id: string) {
    removeVehicle(id);
    setVehicles(getVehicles());
    onChange?.();
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            🚗 My Garage
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {vehicles.length === 0 && !showAddForm && (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🔧</div>
              <p className="text-sm mb-4">
                Save vehicles to your garage and Repair Buddy will tell you when a guide applies to them.
              </p>
            </div>
          )}

          {vehicles.length > 0 && (
            <ul className="space-y-2 mb-4">
              {vehicles.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="text-2xl">🚗</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">
                      {v.year} {v.make} {v.model}
                      {v.trim && <span className="text-gray-500 font-normal"> · {v.trim}</span>}
                    </p>
                    {v.nickname && (
                      <p className="text-xs text-gray-500">&ldquo;{v.nickname}&rdquo;</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemove(v.id)}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {showAddForm ? (
            <form onSubmit={handleAdd} className="space-y-3 p-4 bg-orange-50 border border-orange-100 rounded-lg">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Make (e.g. Toyota)"
                  value={form.make}
                  onChange={(e) => setForm({ ...form, make: e.target.value })}
                  className="px-3 py-2 text-sm rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <input
                  type="text"
                  required
                  placeholder="Model (e.g. Camry)"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="px-3 py-2 text-sm rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <input
                  type="number"
                  required
                  min={1900}
                  max={2100}
                  placeholder="Year (e.g. 2020)"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  className="px-3 py-2 text-sm rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <input
                  type="text"
                  placeholder="Trim (optional)"
                  value={form.trim}
                  onChange={(e) => setForm({ ...form, trim: e.target.value })}
                  className="px-3 py-2 text-sm rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <input
                type="text"
                placeholder="Nickname (optional, e.g. &lsquo;My daily driver&rsquo;)"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded transition-colors"
                >
                  Save vehicle
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded transition-colors"
            >
              + Add vehicle
            </button>
          )}
        </div>

        <div className="p-3 border-t border-gray-200 text-xs text-gray-500 text-center">
          Vehicles are stored in your browser only — nothing is sent to our servers.
        </div>
      </div>
    </div>
  );
}
