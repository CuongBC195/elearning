"use client";

import { useState, type FormEvent } from "react";
import { CERTIFICATES, getCertificateById, getCertificateDisplayName } from "@/constants/certificates";

interface NewEssayModalProps {
  onConfirm: (
    certificateId: string,
    band: string,
    contentType: "full" | "outline",
    outlineLanguage: "vietnamese" | "english"
  ) => void;
  onCancel: () => void;
}

const CONTENT_OPTIONS = [
  {
    value: "full" as const,
    title: "Đoạn văn đầy đủ",
    description: "AI tạo đoạn văn hoàn chỉnh để bạn dịch từ đầu đến cuối",
  },
  {
    value: "outline" as const,
    title: "Dàn bài (Outline)",
    description: "AI chỉ gợi ý các ý chính, bạn tự sáng tạo viết theo dàn ý",
  },
];

const LANGUAGE_OPTIONS = [
  { value: "vietnamese" as const, label: "Tiếng Việt" },
  { value: "english" as const, label: "English" },
];

export default function NewEssayModal({ onConfirm, onCancel }: NewEssayModalProps) {
  const [certificateId, setCertificateId] = useState("ielts-academic");
  const [band, setBand] = useState("7.0");
  const [contentType, setContentType] = useState<"full" | "outline">("full");
  const [outlineLanguage, setOutlineLanguage] = useState<"vietnamese" | "english">("vietnamese");

  const selectedCert = getCertificateById(certificateId);
  const target = selectedCert ? getCertificateDisplayName(certificateId, band) : "";

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onConfirm(certificateId, band, contentType, outlineLanguage);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 sm:p-6">
      <div className="bg-[#131823] rounded-lg border border-gray-800 p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
        <h2 className="text-lg sm:text-xl font-bold text-text-light mb-4 sm:mb-6">Create New Essay</h2>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Select Certificate</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] sm:text-[20px] pointer-events-none">
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
                className="w-full appearance-none bg-card-dark border border-gray-700 text-xs sm:text-sm font-medium rounded pl-9 sm:pl-10 pr-7 sm:pr-8 py-2.5 sm:py-3 focus:outline-none focus:ring-1 focus:ring-primary text-text-light cursor-pointer hover:border-gray-600 transition-colors"
                required
              >
                {CERTIFICATES.map((cert) => (
                  <option key={cert.id} value={cert.id}>
                    {cert.name}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[16px] sm:text-[18px] pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {selectedCert && (
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Target Band/Score</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] sm:text-[20px] pointer-events-none">
                  trending_up
                </span>
                <select
                  value={band}
                  onChange={(e) => setBand(e.target.value)}
                  className="w-full appearance-none bg-card-dark border border-gray-700 text-xs sm:text-sm font-medium rounded pl-9 sm:pl-10 pr-7 sm:pr-8 py-2.5 sm:py-3 focus:outline-none focus:ring-1 focus:ring-primary text-text-light cursor-pointer hover:border-gray-600 transition-colors"
                  required
                >
                  {selectedCert.bands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[16px] sm:text-[18px] pointer-events-none">
                  expand_more
                </span>
              </div>
              {target && (
                <p className="mt-2 text-[10px] sm:text-xs text-gray-400">
                  Target: <span className="text-primary font-semibold">{target}</span>
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">Chọn dạng bài viết</label>
            <div className="space-y-2">
              {CONTENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-start gap-3 p-3 bg-card-dark border border-gray-700 rounded cursor-pointer hover:border-gray-600 transition-colors"
                >
                  <input
                    type="radio"
                    name="contentType"
                    value={option.value}
                    checked={contentType === option.value}
                    onChange={(e) => setContentType(e.target.value as "full" | "outline")}
                    className="w-4 h-4 mt-0.5 text-primary bg-gray-700 border-gray-600 focus:ring-primary focus:ring-2"
                  />
                  <div className="flex-1">
                    <div className="text-xs sm:text-sm text-gray-200 font-medium">{option.title}</div>
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
              Ngôn ngữ {contentType === "full" ? "đoạn văn" : "dàn ý"}
            </label>
            <div className="space-y-2">
              {LANGUAGE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 p-3 bg-card-dark border border-gray-700 rounded cursor-pointer hover:border-gray-600 transition-colors"
                >
                  <input
                    type="radio"
                    name="outlineLanguage"
                    value={option.value}
                    checked={outlineLanguage === option.value}
                    onChange={(e) => setOutlineLanguage(e.target.value as "vietnamese" | "english")}
                    className="w-4 h-4 text-primary bg-gray-700 border-gray-600 focus:ring-primary focus:ring-2"
                  />
                  <span className="text-xs sm:text-sm text-gray-200">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded bg-[#1f2937] hover:bg-[#374151] text-white text-xs sm:text-sm font-medium transition-colors border border-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded bg-primary hover:bg-yellow-400 text-black text-xs sm:text-sm font-bold transition-colors"
            >
              Create Essay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
