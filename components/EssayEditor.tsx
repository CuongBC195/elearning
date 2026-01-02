"use client";

import { useState, useEffect, useRef } from 'react';
import { EssayData, AnalysisResult, Translations, GeneratedTopic, SavedEssay } from '@/types';

interface EssayEditorProps {
  certificateId: string;
  band: string;
  target: string;
  essayId?: string; // ID của essay đang load (nếu có)
  onQuit: () => void; // Callback khi click Quit
}

export default function EssayEditor({ certificateId, band, target, essayId, onQuit }: EssayEditorProps) {
  const [essayData, setEssayData] = useState<EssayData | null>(null);
  const [currentText, setCurrentText] = useState("");
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [feedback, setFeedback] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingTopic, setIsLoadingTopic] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false); // Mobile sidebar toggle
  const [currentEssayId, setCurrentEssayId] = useState<string | undefined>(essayId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastAnalyzedLength = useRef(0);

  // Save essay to localStorage (persistent storage - lưu lâu dài)
  const saveEssayToStorage = (id: string, data: EssayData, content: string) => {
    const savedEssays = localStorage.getItem('saved_essays');
    let essays: SavedEssay[] = savedEssays ? JSON.parse(savedEssays) : [];
    
    const essayIndex = essays.findIndex(e => e.id === id);
    const essayData: SavedEssay = {
      id,
      title: data.title,
      certificateId,
      band,
      target,
      createdAt: essayIndex >= 0 ? essays[essayIndex].createdAt : Date.now(),
      updatedAt: Date.now(),
      content,
      essayData: data
    };

    if (essayIndex >= 0) {
      essays[essayIndex] = essayData;
    } else {
      essays.push(essayData);
    }

    localStorage.setItem('saved_essays', JSON.stringify(essays));
  };

  // Load essay từ localStorage nếu có essayId (tiếp tục bài cũ)
  useEffect(() => {
    if (essayId) {
      setIsLoadingTopic(true);
      const savedEssays = localStorage.getItem('saved_essays');
      if (savedEssays) {
        try {
          const essays: SavedEssay[] = JSON.parse(savedEssays);
          const essay = essays.find(e => e.id === essayId);
          if (essay) {
            // Load bài cũ: set essayData và content đã viết
            setEssayData(essay.essayData);
            setCurrentText(essay.content);
            setCurrentEssayId(essay.id);
            setFeedback(null);
            setAccuracy(0);
            setCurrentSentenceIndex(0);
            lastAnalyzedLength.current = 0;
            setIsLoadingTopic(false);
            return; // Đã load xong, không cần làm gì thêm
          }
        } catch (e) {
          console.error("Error loading essay:", e);
        }
      }
      // Nếu không tìm thấy essay, fallback về tạo mới
      setIsLoadingTopic(false);
    }
  }, [essayId]);

  // Load topic từ API CHỈ KHI TẠO BÀI MỚI (không có essayId)
  useEffect(() => {
    // Chỉ load topic mới khi KHÔNG có essayId (tức là tạo bài mới)
    if (essayId) return; // Nếu có essayId, đã load ở useEffect trên, không cần tạo mới
    
    // Nếu đã có essayData rồi, không load lại
    if (essayData) return;

    const loadTopic = async () => {
      setIsLoadingTopic(true);
      try {
        const res = await fetch('/api/generate-topic', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ certificateId, band })
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to generate topic');
        }

        const data: GeneratedTopic = await res.json();
        const newEssayData = {
          title: data.title,
          sections: data.sections
        };
        setEssayData(newEssayData);

        // Tạo bài mới: tạo essayId mới và lưu vào storage
        const newEssayId = `essay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setCurrentEssayId(newEssayId);
        saveEssayToStorage(newEssayId, newEssayData, "");

        setCurrentText("");
        setFeedback(null);
        setAccuracy(0);
        setCurrentSentenceIndex(0);
        lastAnalyzedLength.current = 0;
      } catch (error: any) {
        console.error("Error loading topic:", error);
        alert(`Failed to load topic: ${error.message}\n\nPlease try again.`);
      } finally {
        setIsLoadingTopic(false);
      }
    };

    loadTopic();
  }, [certificateId, band, essayId]);

  // Auto-save khi text thay đổi
  useEffect(() => {
    if (currentEssayId && essayData && currentText.length >= 0) {
      const timeoutId = setTimeout(() => {
        saveEssayToStorage(currentEssayId, essayData, currentText);
      }, 1000); // Debounce 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [currentText, currentEssayId, essayData, certificateId, band, target]);

  // Auto-analyze sau mỗi câu (sau dấu chấm) - với debounce để tránh gọi quá nhiều
  useEffect(() => {
    if (!currentText || !essayData || isAnalyzing) return;

    // Tìm tất cả các câu đã hoàn thành (kết thúc bằng . ! ?)
    const sentences = currentText.match(/[^.!?]*[.!?]+/g) || [];
    
    // Nếu có câu mới được hoàn thành
    if (sentences.length > currentSentenceIndex) {
      const lastSentence = sentences[sentences.length - 1];
      const newLength = currentText.length;
      
      // Chỉ analyze nếu có thay đổi đáng kể và đã đợi một chút (debounce)
      if (newLength > lastAnalyzedLength.current + 10) {
        // Debounce: đợi 1.5 giây sau khi user ngừng gõ
        const timeoutId = setTimeout(() => {
          // Kiểm tra lại xem có còn là câu mới nhất không
          const currentSentences = currentText.match(/[^.!?]*[.!?]+/g) || [];
          if (currentSentences.length === sentences.length) {
            analyzeCurrentText(lastSentence.trim());
            lastAnalyzedLength.current = newLength;
          }
        }, 1500); // Debounce 1.5 giây

        return () => clearTimeout(timeoutId);
      }
    }
  }, [currentText, essayData, currentSentenceIndex, isAnalyzing]);

  const analyzeCurrentText = async (textToAnalyze: string) => {
    if (!textToAnalyze || !essayData || isAnalyzing) return;

    setIsAnalyzing(true);
    try {
      // Lấy phần tiếng Việt tương ứng (các sentences đầu tiên)
      const allVnText = essayData.sections.map(s => s.vn).join(" ");
      const sentences = textToAnalyze.match(/[^.!?]*[.!?]+/g) || [];
      const currentSentenceCount = sentences.length;
      
      // Estimate phần tiếng Việt tương ứng (đơn giản hóa)
      const estimatedVnText = allVnText;

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userEn: textToAnalyze, 
          sourceVn: estimatedVnText, 
          target 
        })
      });

      if (res.ok) {
        const data = await res.json();
        setFeedback(data);
        setAccuracy(data.accuracy || 0);
        setCurrentSentenceIndex(sentences.length);
      } else {
        const errorData = await res.json();
        // Handle quota error silently for auto-analysis
        if (errorData.type === "QUOTA_EXCEEDED") {
          console.warn("Quota exceeded - auto-analysis skipped");
        }
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      // Silent fail for auto-analysis
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTextChange = (value: string) => {
    setCurrentText(value);
  };

  const handleSubmit = async () => {
    if (!currentText.trim() || !essayData) {
      alert("Vui lòng viết nội dung trước khi submit!");
      return;
    }

    setIsAnalyzing(true);
    try {
      const sourceVn = essayData.sections.map(s => s.vn).join(" ");
      
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userEn: currentText, 
          sourceVn, 
          target 
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        // Special handling for quota exceeded
        if (errorData.type === "QUOTA_EXCEEDED") {
          alert(
            `API Quota Exceeded!\n\n${errorData.details || errorData.error}\n\n` +
            `Free tier allows 20 requests per day. Please try again tomorrow or consider upgrading your plan.`
          );
          return;
        }
        throw new Error(errorData.error || errorData.details || "Analysis failed");
      }

      const data = await res.json();
      setFeedback(data);
      setAccuracy(data.accuracy || 0);
    } catch (error: any) {
      console.error("Analysis error:", error);
      alert(`Failed to analyze: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoadingTopic) {
    return (
      <main className="flex h-screen overflow-hidden bg-background-dark">
        <section className="flex-1 h-full bg-background-dark overflow-y-auto no-scrollbar relative flex justify-center items-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-400">Đang tạo đề bài mới...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!essayData) {
    return (
      <main className="flex h-screen overflow-hidden bg-background-dark">
        <section className="flex-1 h-full bg-background-dark overflow-y-auto no-scrollbar relative flex justify-center items-center">
          <div className="text-center text-red-500">
            <p>Không thể tải đề bài. Vui lòng thử lại.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {/* Header với Question */}
      <div className="flex-none px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800 bg-background-dark">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xs sm:text-sm md:text-base text-gray-300 font-normal leading-relaxed flex-1 min-w-0">
            <span className="text-primary font-bold mr-1">Question:</span>
            <span className="break-words">{essayData.title}</span>
          </h1>
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="lg:hidden p-2 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-300 transition-colors"
            aria-label="Toggle sidebar"
          >
            <span className="material-symbols-outlined text-[20px]">
              {showSidebar ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative bg-background-dark">
        {/* Main Editor Section */}
        <section className="flex-1 h-full flex flex-col border-r-0 lg:border-r border-gray-800 bg-background-dark p-4 sm:p-6 gap-4 sm:gap-6 overflow-hidden">
          {/* Vietnamese Text Display */}
          <div className="flex-1 bg-[#111620] rounded-lg p-4 sm:p-6 overflow-y-auto custom-scrollbar border border-gray-800/50">
            <div className="space-y-4 sm:space-y-6">
              {essayData.sections.map((section, idx) => {
                // Split Vietnamese text into sentences
                const vnSentences = section.vn.match(/[^.!?]*[.!?]+/g) || [section.vn];
                const userSentences = currentText.match(/[^.!?]*[.!?]+/g) || [];
                const currentSentenceIndex = userSentences.length;

                return (
                  <div key={section.id} className="space-y-2">
                    <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
                      {section.label}
                    </h3>
                    <p className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-gray-400">
                      {vnSentences.map((sentence, sIdx) => {
                        // Calculate global sentence index across all sections
                        let globalSentenceIndex = 0;
                        for (let i = 0; i < idx; i++) {
                          const prevSentences = essayData.sections[i].vn.match(/[^.!?]*[.!?]+/g) || [essayData.sections[i].vn];
                          globalSentenceIndex += prevSentences.length;
                        }
                        globalSentenceIndex += sIdx;
                        
                        // Highlight sentence that user is currently writing
                        const isHighlighted = globalSentenceIndex === currentSentenceIndex && currentText.length > 0;
                        
                        return (
                          <span key={sIdx} className={isHighlighted ? "text-pink-500 font-semibold" : ""}>
                            {sentence}
                          </span>
                        );
                      })}
                    </p>
                    {idx < essayData.sections.length - 1 && <div className="h-4"></div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* English Input Textarea */}
          <div className="h-[150px] sm:h-[180px] relative flex flex-col gap-4">
            <div className="relative w-full h-full rounded-lg border border-primary/50 bg-[#131926] overflow-hidden focus-within:border-primary transition-colors">
              <textarea
                ref={textareaRef}
                value={currentText}
                onChange={(e) => handleTextChange(e.target.value)}
                className="w-full h-full bg-transparent border-none p-3 sm:p-4 text-sm sm:text-base text-gray-200 placeholder-gray-500 focus:ring-0 resize-none font-medium custom-scrollbar"
                placeholder="Start writing your translation here..."
                spellCheck="false"
              />
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between h-auto sm:h-12 gap-2 sm:gap-0">
            <button
              onClick={onQuit}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded bg-[#1f2937] hover:bg-[#374151] text-white text-xs sm:text-sm font-medium transition-colors border border-gray-700"
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[18px]">arrow_back</span>
              <span className="hidden sm:inline">Quit</span>
            </button>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowHint(!showHint)}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded bg-[#1f2937] hover:bg-[#374151] text-white text-xs sm:text-sm font-medium transition-colors border border-gray-700"
              >
                <span className={`material-symbols-outlined text-[16px] sm:text-[18px] ${showHint ? "text-primary" : "text-gray-400"}`}>lightbulb</span>
                <span className="hidden sm:inline">Hint</span>
              </button>
              <button
                onClick={handleSubmit}
                disabled={isAnalyzing || !currentText.trim()}
                className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded bg-primary hover:bg-yellow-400 text-black text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          </div>
        </section>

        {/* Sidebar - Hidden on mobile, toggleable */}
        <aside className={`${showSidebar ? 'fixed' : 'hidden'} lg:relative lg:flex lg:${showSidebar ? '' : 'flex'} w-full lg:w-[400px] h-full lg:h-auto top-0 right-0 z-40 lg:z-auto flex-none bg-[#0e121a] border-l border-gray-800 p-4 sm:p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 sm:gap-6`}>
          {/* Close button for mobile */}
          <button
            onClick={() => setShowSidebar(false)}
            className="lg:hidden self-end p-2 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-300 transition-colors mb-2"
            aria-label="Close sidebar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
          {/* Dictionary & Accuracy */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-[#1a212e] rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center gap-1 sm:gap-2 border border-gray-800 cursor-pointer hover:bg-[#232d3f] transition-colors group">
              <span className="material-symbols-outlined text-[20px] sm:text-[24px] text-gray-400 group-hover:text-white">menu_book</span>
              <span className="text-xs sm:text-sm font-medium text-gray-300">Dictionary</span>
            </div>
            <div className="bg-[#1a212e] rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center gap-1 border border-gray-800">
              <div className="relative w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border-2 border-green-500 text-green-500 mb-1">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-green-500 rounded-full"></div>
              </div>
              <span className="text-xs sm:text-sm font-bold text-gray-200">{accuracy.toFixed(0)}%</span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Accuracy</span>
            </div>
          </div>

          {/* Hint Section */}
          {showHint && essayData && (
            <div className="bg-[#131823] rounded-lg p-4 sm:p-5 border border-gray-800">
              <h3 className="text-base sm:text-lg font-bold text-gray-200 mb-2 sm:mb-3">Gợi ý từ khóa</h3>
              <div className="space-y-2">
                <p className="text-xs sm:text-sm text-gray-400">Một số từ khóa tiếng Anh hữu ích:</p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {essayData.title.split(' ').slice(0, 8).map((word, i) => (
                    <span key={i} className="px-2 sm:px-3 py-1 bg-[#1a212e] rounded-full text-[10px] sm:text-xs text-gray-300 border border-gray-700">
                      {word.toLowerCase().replace(/[^a-z]/g, '')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Feedback Section */}
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-200">Feedback</h3>
              {isAnalyzing && (
                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-400">
                  <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Analyzing...</span>
                </div>
              )}
            </div>
            {feedback ? (
              <div className="bg-[#131823] rounded-lg p-4 sm:p-5 border border-gray-800 space-y-4 sm:space-y-5">
                {feedback.suggestions && feedback.suggestions.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-xs sm:text-sm mb-2 sm:mb-3 font-medium">Suggested improvements:</p>
                    <ul className="space-y-2 sm:space-y-3">
                      {feedback.suggestions.map((s, i) => (
                        <li key={i} className="flex gap-2 sm:gap-3 text-xs sm:text-sm text-gray-300">
                          <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-gray-500 mt-1.5 sm:mt-2 flex-none"></span>
                          <span className="leading-relaxed break-words">
                            {s.error && (
                              <>
                                <span className="line-through text-red-400">{s.error}</span> →{' '}
                                <span className="text-primary font-bold">{s.fix}</span>
                              </>
                            )}
                            {s.reason && <><br className="hidden sm:block"/><span className="block sm:inline">{s.reason}</span></>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(!feedback.suggestions || feedback.suggestions.length === 0) && (
                  <div className="text-center py-3 sm:py-4">
                    <p className="text-xs sm:text-sm text-gray-400">Không có gợi ý cải thiện. Bài viết của bạn rất tốt!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#131823] rounded-lg p-4 sm:p-5 border border-gray-800">
                <p className="text-gray-500 text-xs sm:text-sm text-center">
                  {isAnalyzing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                      <span className="hidden sm:inline">Đang phân tích...</span>
                      <span className="sm:hidden">Đang phân tích</span>
                    </span>
                  ) : (
                    "Viết để nhận feedback tự động"
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Achievements (placeholder)
          <div className="mt-auto">
            <h3 className="text-lg font-bold text-gray-200 mb-4">Today's Achievements</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1a212e] rounded-lg p-4 flex flex-col items-center justify-center gap-2 border border-gray-800 min-h-[100px]">
                <span className="material-symbols-outlined text-orange-500 text-3xl">local_fire_department</span>
                <span className="text-sm font-medium text-gray-300">1 Day Streak</span>
              </div>
              <div className="bg-[#1a212e] rounded-lg p-4 flex flex-col items-center justify-center gap-2 border border-gray-800 min-h-[100px]">
                <span className="material-symbols-outlined text-yellow-100 text-3xl drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">lightbulb</span>
                <span className="text-sm font-medium text-gray-300">Bright Mind</span>
              </div>
            </div>
          </div> */}
        </aside>
      </main>
    </>
  );
}
