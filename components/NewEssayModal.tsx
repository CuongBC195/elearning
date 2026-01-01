"use client";

import { useState } from 'react';
import { CERTIFICATES, getCertificateById, getCertificateDisplayName } from '@/constants/certificates';

interface NewEssayModalProps {
  onConfirm: (certificateId: string, band: string) => void;
  onCancel: () => void;
}

export default function NewEssayModal({ onConfirm, onCancel }: NewEssayModalProps) {
  const [certificateId, setCertificateId] = useState("ielts-academic");
  const [band, setBand] = useState("7.0");

  const selectedCert = getCertificateById(certificateId);
  const target = selectedCert ? getCertificateDisplayName(certificateId, band) : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(certificateId, band);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#131823] rounded-lg border border-gray-800 p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-text-light mb-6">Create New Essay</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Certificate Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Certificate
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px] pointer-events-none">
                school
              </span>
              <select
                value={certificateId}
                onChange={(e) => {
                  const newCertId = e.target.value;
                  setCertificateId(newCertId);
                  const newCert = getCertificateById(newCertId);
                  if (newCert && newCert.bands.length > 0) {
                    setBand(newCert.bands[Math.floor(newCert.bands.length / 2)]);
                  }
                }}
                className="w-full appearance-none bg-card-dark border border-gray-700 text-sm font-medium rounded pl-10 pr-8 py-3 focus:outline-none focus:ring-1 focus:ring-primary text-text-light cursor-pointer hover:border-gray-600 transition-colors"
                required
              >
                {CERTIFICATES.map((cert) => (
                  <option key={cert.id} value={cert.id}>
                    {cert.name}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Band Selection */}
          {selectedCert && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target Band/Score
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[20px] pointer-events-none">
                  trending_up
                </span>
                <select
                  value={band}
                  onChange={(e) => setBand(e.target.value)}
                  className="w-full appearance-none bg-card-dark border border-gray-700 text-sm font-medium rounded pl-10 pr-8 py-3 focus:outline-none focus:ring-1 focus:ring-primary text-text-light cursor-pointer hover:border-gray-600 transition-colors"
                  required
                >
                  {selectedCert.bands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] pointer-events-none">
                  expand_more
                </span>
              </div>
              {target && (
                <p className="mt-2 text-xs text-gray-400">
                  Target: <span className="text-primary font-semibold">{target}</span>
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 rounded bg-[#1f2937] hover:bg-[#374151] text-white text-sm font-medium transition-colors border border-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 rounded bg-primary hover:bg-yellow-400 text-black text-sm font-bold transition-colors"
            >
              Create Essay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

