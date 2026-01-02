"use client";

import { useState, useEffect } from 'react';
import { SavedEssay } from '@/types';
import { CERTIFICATES, getCertificateDisplayName } from '@/constants/certificates';

interface EssayListProps {
  onSelectEssay: (essay: SavedEssay) => void;
  onNewEssay: () => void;
}

export default function EssayList({ onSelectEssay, onNewEssay }: EssayListProps) {
  const [essays, setEssays] = useState<SavedEssay[]>([]);

  useEffect(() => {
    // Load essays from localStorage (persistent storage)
    const savedEssays = localStorage.getItem('saved_essays');
    if (savedEssays) {
      try {
        const parsed = JSON.parse(savedEssays);
        // Sort by updatedAt descending
        const sorted = parsed.sort((a: SavedEssay, b: SavedEssay) => b.updatedAt - a.updatedAt);
        setEssays(sorted);
      } catch (e) {
        console.error("Error parsing saved essays:", e);
      }
    }
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const deleteEssay = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = essays.filter(e => e.id !== id);
    setEssays(updated);
    localStorage.setItem('saved_essays', JSON.stringify(updated));
  };

  return (
    <div className="h-screen bg-background-dark flex flex-col">
      {/* Header */}
      <header className="flex-none px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800 bg-background-dark">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="size-8 sm:size-10 flex items-center justify-center flex-shrink-0">
              <img 
                src="/logo.png" 
                alt="3DO Learning Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-text-light truncate">
              3DO Learning Writing
            </h1>
          </div>
          <button
            onClick={onNewEssay}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded bg-primary hover:bg-yellow-400 text-black text-xs sm:text-sm font-bold transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">add</span>
            <span className="hidden sm:inline">New Essay</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-bold text-text-light mb-4 sm:mb-6">My Essays</h2>
          
          {essays.length === 0 ? (
            <div className="text-center py-12 sm:py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-800 mb-3 sm:mb-4">
                <span className="material-symbols-outlined text-3xl sm:text-4xl text-gray-500">article</span>
              </div>
              <p className="text-gray-400 text-base sm:text-lg mb-2">Chưa có bài làm nào</p>
              <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6 px-4">Tạo bài làm mới để bắt đầu luyện tập</p>
              <button
                onClick={onNewEssay}
                className="px-5 sm:px-6 py-2.5 sm:py-3 rounded bg-primary hover:bg-yellow-400 text-black text-sm sm:text-base font-bold transition-colors"
              >
                Tạo bài làm mới
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {essays.map((essay) => (
                <div
                  key={essay.id}
                  onClick={() => onSelectEssay(essay)}
                  className="bg-[#131823] rounded-lg p-4 sm:p-5 border border-gray-800 hover:border-gray-700 cursor-pointer transition-colors group"
                >
                  <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-text-light mb-1 sm:mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {essay.title}
                      </h3>
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-400 flex-wrap">
                        <span className="font-medium truncate">{getCertificateDisplayName(essay.certificateId, essay.band)}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{formatDate(essay.updatedAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteEssay(essay.id, e)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 sm:p-2 hover:bg-gray-800 rounded transition-all flex-shrink-0"
                      title="Delete essay"
                    >
                      <span className="material-symbols-outlined text-gray-400 hover:text-red-400 text-[18px] sm:text-[20px]">
                        delete
                      </span>
                    </button>
                  </div>
                  
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-800">
                    <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-500">
                      <span>{essay.content.length > 0 ? `${essay.content.split(/\s+/).length} words` : "Chưa có nội dung"}</span>
                      <span className="text-primary font-medium hidden sm:inline">Click để tiếp tục →</span>
                      <span className="text-primary font-medium sm:hidden">Tiếp tục →</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

