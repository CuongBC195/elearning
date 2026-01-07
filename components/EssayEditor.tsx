"use client";

import { useState, useEffect, useRef } from 'react';
import { EssayData, AnalysisResult, Translations, GeneratedTopic, SavedEssay, EssaySummary, AnalysisSuggestion, SectionFeedback, EssayScore } from '@/types';
import { calculateScore } from '@/lib/essay-scorer';
import ScorePanel from './ScorePanel';

// Client-side throttle: minimum 5 seconds between API calls
const THROTTLE_MS = 5000;

// Local cache for API responses (32 entries max)
const LOCAL_CACHE_KEY = 'essay_analysis_cache';
const MAX_CACHE_ENTRIES = 32;

// Simple hash function for cache key
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Get cached response from localStorage
function getLocalCache(key: string): AnalysisResult | null {
  try {
    const cached = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!cached) return null;
    const cache = JSON.parse(cached);
    return cache[key] || null;
  } catch {
    return null;
  }
}

// Set cached response in localStorage
function setLocalCache(key: string, value: AnalysisResult): void {
  try {
    const cached = localStorage.getItem(LOCAL_CACHE_KEY);
    let cache = cached ? JSON.parse(cached) : {};
    cache[key] = value;
    // Limit cache size
    const keys = Object.keys(cache);
    if (keys.length > MAX_CACHE_ENTRIES) {
      delete cache[keys[0]];
    }
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache errors
  }
}

interface EssayEditorProps {
  certificateId: string;
  band: string;
  target: string;
  essayId?: string; // ID của essay đang load (nếu có)
  contentType?: "full" | "outline"; // Type of content
  outlineLanguage?: "vietnamese" | "english"; // Language of the content
  onQuit: () => void; // Callback khi click Quit
}

export default function EssayEditor({ certificateId, band, target, essayId, contentType, outlineLanguage, onQuit }: EssayEditorProps) {
  const [essayData, setEssayData] = useState<EssayData | null>(null);
  const [currentText, setCurrentText] = useState("");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0); // Index của section đang viết
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [feedback, setFeedback] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingTopic, setIsLoadingTopic] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false); // Mobile sidebar toggle
  const [currentEssayId, setCurrentEssayId] = useState<string | undefined>(essayId);
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState<EssaySummary | null>(null);
  const [allFeedbacks, setAllFeedbacks] = useState<AnalysisResult[]>([]); // Lưu tất cả feedback để tổng kết
  const [isCompleted, setIsCompleted] = useState(false); // Đánh dấu bài đã hoàn thành
  const [sectionContents, setSectionContents] = useState<{ [sectionId: string]: string }>({}); // Nội dung từng section
  const [sectionFeedbacks, setSectionFeedbacks] = useState<{ [sectionId: string]: SectionFeedback }>({}); // Feedback từng section
  const [expandedErrorIndex, setExpandedErrorIndex] = useState<number | null>(null); // Track lỗi đang expand
  const [essayScore, setEssayScore] = useState<EssayScore | null>(null); // Score khi hoàn thành
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastAnalyzedContent = useRef<{ [sectionId: string]: string }>({}); // Track content đã analyze cho từng section
  const isLoadingTopicRef = useRef(false); // Prevent duplicate topic loading
  const lastRequestTime = useRef<number>(0); // Throttle: track last API call time

  // Helper: Lấy current section
  const getCurrentSection = () => {
    if (!essayData || essayData.sections.length === 0) return null;
    return essayData.sections[currentSectionIndex] || essayData.sections[0];
  };

  // Helper: Lấy text của current section
  const getCurrentSectionText = () => {
    const section = getCurrentSection();
    if (!section) return "";
    return sectionContents[section.id] || "";
  };

  // Helper: Set text cho current section
  const setCurrentSectionText = (text: string) => {
    const section = getCurrentSection();
    if (!section) return;
    setSectionContents(prev => ({
      ...prev,
      [section.id]: text
    }));
    // Cập nhật currentText = tổng tất cả sections
    updateTotalContent(section.id, text);
  };

  // Helper: Cập nhật tổng nội dung từ tất cả sections
  const updateTotalContent = (updatedSectionId: string, newText: string) => {
    if (!essayData) return;
    const allContents = essayData.sections.map(s => {
      if (s.id === updatedSectionId) return newText;
      return sectionContents[s.id] || "";
    }).filter(t => t.trim()).join("\n\n");
    setCurrentText(allContents);
  };

  // Helper: Tính total errors từ tất cả section feedbacks VÀ global feedback
  const getTotalErrors = (): { grammar: number; vocabulary: number; total: number; allSuggestions: AnalysisSuggestion[] } => {
    let grammar = 0;
    let vocabulary = 0;
    const allSuggestions: AnalysisSuggestion[] = [];

    // Count from section feedbacks
    Object.values(sectionFeedbacks).forEach(sf => {
      sf.suggestions.forEach(s => {
        allSuggestions.push(s);
        const reason = s.reason?.toLowerCase() || "";
        if (reason.includes("ngữ pháp") || reason.includes("grammar") || reason.includes("cấu trúc") || reason.includes("động từ") || reason.includes("mạo từ") || reason.includes("tense") || reason.includes("verb") || reason.includes("subject")) {
          grammar++;
        } else {
          vocabulary++;
        }
      });
    });

    // Also count from global feedback if exists
    if (feedback?.suggestions) {
      feedback.suggestions.forEach(s => {
        // Avoid duplicates - check if already in allSuggestions
        const isDuplicate = allSuggestions.some(existing => existing.error === s.error && existing.fix === s.fix);
        if (!isDuplicate) {
          allSuggestions.push(s);
          const reason = s.reason?.toLowerCase() || "";
          if (reason.includes("ngữ pháp") || reason.includes("grammar") || reason.includes("cấu trúc") || reason.includes("động từ") || reason.includes("mạo từ") || reason.includes("tense") || reason.includes("verb") || reason.includes("subject")) {
            grammar++;
          } else {
            vocabulary++;
          }
        }
      });
    }

    return { grammar, vocabulary, total: grammar + vocabulary, allSuggestions };
  };

  // Save essay to localStorage (persistent storage - lưu lâu dài)
  const saveEssayToStorage = (id: string, data: EssayData, content: string, notesToSave?: string, summaryToSave?: EssaySummary, finalFeedbackToSave?: AnalysisResult, contentTyp?: "full" | "outline", outlineLang?: "vietnamese" | "english", secContents?: { [sectionId: string]: string }, secFeedbacks?: { [sectionId: string]: SectionFeedback }) => {
    const savedEssays = localStorage.getItem('saved_essays');
    let essays: SavedEssay[] = savedEssays ? JSON.parse(savedEssays) : [];

    const essayIndex = essays.findIndex(e => e.id === id);
    const essayDataToSave: SavedEssay = {
      id,
      title: data.title,
      certificateId,
      band,
      target,
      createdAt: essayIndex >= 0 ? essays[essayIndex].createdAt : Date.now(),
      updatedAt: Date.now(),
      content,
      sectionContents: secContents !== undefined ? secContents : (essayIndex >= 0 ? essays[essayIndex].sectionContents : {}),
      sectionFeedbacks: secFeedbacks !== undefined ? secFeedbacks : (essayIndex >= 0 ? essays[essayIndex].sectionFeedbacks : {}),
      essayData: data,
      notes: notesToSave !== undefined ? notesToSave : (essayIndex >= 0 ? essays[essayIndex].notes : ""),
      summary: summaryToSave !== undefined ? summaryToSave : (essayIndex >= 0 ? essays[essayIndex].summary : undefined),
      finalFeedback: finalFeedbackToSave !== undefined ? finalFeedbackToSave : (essayIndex >= 0 ? essays[essayIndex].finalFeedback : undefined),
      contentType: contentTyp !== undefined ? contentTyp : (essayIndex >= 0 ? essays[essayIndex].contentType : "full"),
      outlineLanguage: outlineLang !== undefined ? outlineLang : (essayIndex >= 0 ? essays[essayIndex].outlineLanguage : "vietnamese")
    };

    if (essayIndex >= 0) {
      essays[essayIndex] = essayDataToSave;
    } else {
      essays.push(essayDataToSave);
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
            setNotes(essay.notes || "");
            setSummary(essay.summary || null);
            // Load section contents và feedbacks nếu có
            if (essay.sectionContents) {
              setSectionContents(essay.sectionContents);
            }
            if (essay.sectionFeedbacks) {
              setSectionFeedbacks(essay.sectionFeedbacks);
              // Cập nhật lastAnalyzedContent
              Object.entries(essay.sectionFeedbacks).forEach(([sectionId, sf]) => {
                lastAnalyzedContent.current[sectionId] = sf.lastAnalyzedContent;
              });
            }
            // Load feedback cuối cùng nếu có
            if (essay.finalFeedback) {
              setFeedback(essay.finalFeedback);
              setAccuracy(essay.finalFeedback.accuracy || 0);
            } else {
              setFeedback(null);
              setAccuracy(0);
            }
            // Kiểm tra xem bài đã hoàn thành chưa (progress = 100%)
            const totalVnSentences = essay.essayData.sections.reduce((acc, section) => {
              const sentences = section.vn.match(/[^.!?]*[.!?]+/g) || [section.vn];
              return acc + sentences.length;
            }, 0);
            const userSentences = essay.content.match(/[^.!?]*[.!?]+/g) || [];
            const progress = Math.min(100, Math.round((userSentences.length / totalVnSentences) * 100));
            setIsCompleted(progress >= 100);
            setCurrentSentenceIndex(userSentences.length);
            setAllFeedbacks([]);
            // Load score if exists - also set isCompleted to show score panel
            if (essay.score) {
              setEssayScore(essay.score);
              setIsCompleted(true); // Đảm bảo hiển thị score panel
            }
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

    // Prevent duplicate requests
    if (isLoadingTopicRef.current) {
      console.log("⚠ Topic loading already in progress, skipping duplicate request");
      return;
    }

    const loadTopic = async () => {
      isLoadingTopicRef.current = true;
      setIsLoadingTopic(true);
      try {
        console.log("📝 Loading new topic for:", certificateId, band, "Content type:", contentType, "Language:", outlineLanguage);
        const res = await fetch('/api/generate-topic', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            certificateId,
            band,
            contentType: contentType || "full",
            outlineLanguage: outlineLanguage || "vietnamese"
          })
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
        saveEssayToStorage(newEssayId, newEssayData, "", undefined, undefined, undefined, contentType || "full", outlineLanguage || "vietnamese");

        setCurrentText("");
        setSectionContents({});
        setSectionFeedbacks({});
        setFeedback(null);
        setAccuracy(0);
        setCurrentSentenceIndex(0);
        lastAnalyzedContent.current = {};
        console.log("✓ Topic loaded successfully, essayId:", newEssayId);
      } catch (error: any) {
        console.error("Error loading topic:", error);
        alert(`Failed to load topic: ${error.message}\n\nPlease try again.`);
      } finally {
        setIsLoadingTopic(false);
        isLoadingTopicRef.current = false;
      }
    };

    loadTopic();
  }, [certificateId, band, essayId, essayData, contentType, outlineLanguage]);

  // Auto-save khi text thay đổi
  useEffect(() => {
    if (currentEssayId && essayData) {
      const timeoutId = setTimeout(() => {
        // Lấy finalFeedback từ state nếu có
        const finalFeedbackToSave = feedback || undefined;
        saveEssayToStorage(
          currentEssayId,
          essayData,
          currentText,
          notes,
          summary || undefined,
          finalFeedbackToSave,
          undefined,
          outlineLanguage || "vietnamese",
          sectionContents,
          sectionFeedbacks
        );
      }, 1000); // Debounce 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [currentText, currentEssayId, essayData, certificateId, band, target, notes, summary, feedback, outlineLanguage, sectionContents, sectionFeedbacks]);

  // Kiểm tra progress và đánh dấu hoàn thành
  useEffect(() => {
    if (!essayData) return;
    const progress = calculateProgress();
    if (progress >= 100 && !isCompleted) {
      setIsCompleted(true);
    } else if (progress < 100 && isCompleted) {
      setIsCompleted(false);
    }
  }, [currentText, essayData, isCompleted]);

  // Auto-analyze CHỈ PHẦN MỚI của toàn bộ text
  useEffect(() => {
    if (!essayData || isAnalyzing || isCompleted || !currentText.trim()) return;

    // Lấy phần text đã analyze lần cuối
    const lastAnalyzed = lastAnalyzedContent.current['_global'] || "";

    // Kiểm tra xem có text mới chưa được analyze không
    if (currentText.length <= lastAnalyzed.length) return;

    // Tìm phần text mới (chỉ analyze phần chưa analyze)
    const newText = currentText.slice(lastAnalyzed.length).trim();

    // Chỉ analyze khi có câu hoàn chỉnh mới (kết thúc bằng . ! ?)
    const newSentences = newText.match(/[^.!?]*[.!?]+/g) || [];
    if (newSentences.length === 0) return;

    // Debounce: đợi 1.5 giây sau khi user ngừng gõ
    const timeoutId = setTimeout(() => {
      // Chỉ analyze phần mới
      analyzeNewContent('_global', newText, essayData.sections.map(s => s.vn).join(" "));
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [currentText, essayData, isAnalyzing, isCompleted]);

  // Analyze CHỈ PHẦN MỚI của text
  const analyzeNewContent = async (sectionId: string, newText: string, sectionVn: string) => {
    if (!newText.trim() || !essayData || isAnalyzing) return;

    // Throttle: enforce 5-second gap between requests
    const now = Date.now();
    if (now - lastRequestTime.current < THROTTLE_MS) {
      console.log(`⏳ Throttled: waiting ${Math.ceil((THROTTLE_MS - (now - lastRequestTime.current)) / 1000)}s`);
      return;
    }

    // Check local cache first
    const cacheKey = simpleHash(`${newText}|${sectionVn}|${target}`);
    const cachedResult = getLocalCache(cacheKey);
    if (cachedResult) {
      console.log('✓ Local cache hit - using cached feedback');
      setFeedback(cachedResult);
      setAccuracy(cachedResult.accuracy || 0);
      lastAnalyzedContent.current[sectionId] = currentText;
      setSectionFeedbacks(prev => {
        const existingFeedback = prev[sectionId];
        const existingSuggestions = existingFeedback?.suggestions || [];
        const newSuggestions = (cachedResult.suggestions || []).map(s => ({ ...s, sectionId }));
        return {
          ...prev,
          [sectionId]: {
            sectionId,
            content: currentText,
            lastAnalyzedContent: currentText,
            feedback: cachedResult,
            suggestions: [...existingSuggestions, ...newSuggestions],
            analyzedAt: Date.now()
          }
        };
      });
      setAllFeedbacks(prev => [...prev, cachedResult]);
      return;
    }

    // Update throttle timestamp
    lastRequestTime.current = now;
    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEn: newText,
          sourceVn: sectionVn,
          target
        })
      });

      if (res.ok) {
        const data: AnalysisResult = await res.json();
        setFeedback(data);
        setAccuracy(data.accuracy || 0);

        // Save to local cache
        setLocalCache(cacheKey, data);

        // Cập nhật lastAnalyzedContent với currentText hiện tại
        lastAnalyzedContent.current[sectionId] = currentText;

        // Lưu feedback (MERGE với feedback cũ, không thay thế)
        setSectionFeedbacks(prev => {
          const existingFeedback = prev[sectionId];
          const existingSuggestions = existingFeedback?.suggestions || [];

          // Thêm sectionId vào mỗi suggestion mới để track nguồn gốc
          const newSuggestions = (data.suggestions || []).map(s => ({
            ...s,
            sectionId
          }));

          return {
            ...prev,
            [sectionId]: {
              sectionId,
              content: currentText,
              lastAnalyzedContent: currentText,
              feedback: data,
              suggestions: [...existingSuggestions, ...newSuggestions], // MERGE - giữ lại errors cũ
              analyzedAt: Date.now()
            }
          };
        });

        // Cũng lưu vào allFeedbacks để backward compatible
        setAllFeedbacks(prev => [...prev, data]);
      } else {
        const errorData = await res.json();
        if (errorData.type === "QUOTA_EXCEEDED" || res.status === 429) {
          console.warn("Rate limited or quota exceeded - analysis skipped");
        }
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
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

      // Lưu feedback cuối cùng vào danh sách
      const updatedFeedbacks = [...allFeedbacks, data];
      setAllFeedbacks(updatedFeedbacks);

      // Tạo summary từ TẤT CẢ section feedbacks (không phải từ allFeedbacks)
      const newSummary = createSummaryFromSections();
      setSummary(newSummary);

      // Đánh dấu bài đã hoàn thành nếu progress = 100%
      const progress = calculateProgress();
      if (progress >= 100) {
        setIsCompleted(true);
      }

      // Lưu summary và finalFeedback vào storage
      if (currentEssayId && essayData) {
        saveEssayToStorage(
          currentEssayId,
          essayData,
          currentText,
          notes,
          newSummary,
          data,
          undefined,
          undefined,
          sectionContents,
          sectionFeedbacks
        );
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      alert(`Failed to analyze: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Tính toán progress dựa trên số câu đã viết
  const calculateProgress = (): number => {
    if (!essayData) return 0;
    const totalVnSentences = essayData.sections.reduce((acc, section) => {
      const sentences = section.vn.match(/[^.!?]*[.!?]+/g) || [section.vn];
      return acc + sentences.length;
    }, 0);

    const userSentences = currentText.match(/[^.!?]*[.!?]+/g) || [];
    const progress = Math.min(100, Math.round((userSentences.length / totalVnSentences) * 100));
    return progress;
  };

  // Tạo summary từ TẤT CẢ section feedbacks - đảm bảo không mất dữ liệu khi chuyển section
  const createSummaryFromSections = (): EssaySummary => {
    const { grammar, vocabulary, total, allSuggestions } = getTotalErrors();

    const grammarMistakes: string[] = [];
    const vocabIssues: string[] = [];

    allSuggestions.forEach(s => {
      const reason = s.reason?.toLowerCase() || "";
      if (reason.includes("ngữ pháp") || reason.includes("grammar") || reason.includes("cấu trúc") || reason.includes("động từ") || reason.includes("mạo từ") || reason.includes("tense") || reason.includes("verb") || reason.includes("subject")) {
        if (!grammarMistakes.includes(s.error)) {
          grammarMistakes.push(s.error);
        }
      } else {
        if (!vocabIssues.includes(s.error)) {
          vocabIssues.push(s.error);
        }
      }
    });

    return {
      grammarErrors: grammar,
      vocabularyErrors: vocabulary,
      totalErrors: total,
      commonGrammarMistakes: grammarMistakes.slice(0, 5),
      commonVocabularyIssues: vocabIssues.slice(0, 5),
      allSuggestions,
      accuracy: accuracy,
      completedAt: Date.now()
    };
  };

  // Auto-calculate score when progress reaches 100% AND AI analysis is complete
  useEffect(() => {
    const progress = calculateProgress();
    // Check if we have any feedback - either from sectionFeedbacks or global feedback
    const hasSectionFeedback = Object.values(sectionFeedbacks).some(sf => sf.feedback !== null || sf.suggestions.length > 0);
    const hasGlobalFeedback = feedback !== null;
    const hasAnyFeedback = hasSectionFeedback || hasGlobalFeedback;

    // Only score when:
    // 1. Progress >= 100%
    // 2. Not already completed/scored
    // 3. Not currently analyzing
    // 4. Has at least some feedback from AI
    if (progress >= 100 && !isCompleted && !essayScore && !isAnalyzing && hasAnyFeedback) {
      // Đánh dấu hoàn thành
      setIsCompleted(true);

      // Tính điểm từ feedback history
      const summaryData = createSummaryFromSections();
      const score = calculateScore(summaryData, band, certificateId);
      setEssayScore(score);
      setSummary(summaryData);

      // Lưu vào storage ngay lập tức
      if (currentEssayId && essayData) {
        const savedEssays = localStorage.getItem('saved_essays');
        if (savedEssays) {
          const essays: SavedEssay[] = JSON.parse(savedEssays);
          const essayIndex = essays.findIndex(e => e.id === currentEssayId);
          if (essayIndex >= 0) {
            essays[essayIndex].score = score;
            essays[essayIndex].summary = summaryData;
            essays[essayIndex].sectionFeedbacks = sectionFeedbacks;
            localStorage.setItem('saved_essays', JSON.stringify(essays));
          }
        }
      }
    }
  }, [currentText, essayData, isAnalyzing, sectionFeedbacks, feedback]);

  // Legacy: Tạo summary từ allFeedbacks (backward compatible)
  const createSummary = (feedbacks: AnalysisResult[], finalAccuracy: number): EssaySummary => {
    // Ưu tiên dùng section feedbacks nếu có
    if (Object.keys(sectionFeedbacks).length > 0) {
      return createSummaryFromSections();
    }

    // Fallback: dùng allFeedbacks
    const grammarErrors: string[] = [];
    const vocabularyIssues: string[] = [];
    const allSuggestions: AnalysisSuggestion[] = [];
    let totalErrors = 0;

    feedbacks.forEach(fb => {
      if (fb.suggestions) {
        fb.suggestions.forEach(s => {
          totalErrors++;
          allSuggestions.push(s);
          const reason = s.reason?.toLowerCase() || "";
          if (reason.includes("ngữ pháp") || reason.includes("grammar") || reason.includes("cấu trúc") || reason.includes("động từ") || reason.includes("mạo từ")) {
            if (!grammarErrors.includes(s.error)) {
              grammarErrors.push(s.error);
            }
          } else if (reason.includes("từ vựng") || reason.includes("vocabulary") || reason.includes("từ")) {
            if (!vocabularyIssues.includes(s.error)) {
              vocabularyIssues.push(s.error);
            }
          }
        });
      }
    });

    return {
      grammarErrors: grammarErrors.length,
      vocabularyErrors: vocabularyIssues.length,
      totalErrors,
      commonGrammarMistakes: grammarErrors.slice(0, 5),
      commonVocabularyIssues: vocabularyIssues.slice(0, 5),
      allSuggestions,
      accuracy: finalAccuracy,
      completedAt: Date.now()
    };
  };

  // Lưu notes khi thay đổi
  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (currentEssayId && essayData) {
      saveEssayToStorage(currentEssayId, essayData, currentText, value, summary || undefined, undefined, contentType || "full", outlineLanguage || "vietnamese");
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
      {/* Header - chỉ chứa logo và mobile toggle */}
      <div className="flex-none px-4 sm:px-6 py-2 border-b border-gray-800 bg-background-dark lg:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-6 flex items-center justify-center">
              <img src="/logo.png" alt="3DO Learning" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-semibold text-gray-300">3DO Learning</span>
          </div>
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-300 transition-colors"
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
        <section className="flex-1 h-full flex flex-col border-r-0 lg:border-r border-gray-800 bg-background-dark overflow-hidden">
          {/* Question Box - inside main section */}
          <div className="flex-none px-4 sm:px-6 py-3 border-b border-gray-800/50">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="size-6 sm:size-8 flex items-center justify-center flex-shrink-0 mt-1 hidden lg:flex">
                <img src="/logo.png" alt="3DO Learning" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1 min-w-0 bg-gradient-to-r from-[#1a212e] to-[#111620] rounded-lg p-2 sm:p-3 border border-gray-700/50">
                <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary mb-1">
                  Question
                </div>
                <div className="text-xs sm:text-sm text-gray-200 leading-relaxed whitespace-pre-line">
                  {essayData.title.trim()}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar - inside main section */}
          <div className="flex-none px-4 sm:px-6 py-2 border-b border-gray-800/50">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-medium">Progress:</span>
              <div className="flex-1 h-2 bg-[#1a212e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${calculateProgress()}%` }}
                ></div>
              </div>
              <span className="text-xs text-gray-300 font-bold min-w-[40px] text-right">{calculateProgress()}%</span>
            </div>
          </div>

          {/* Content area with padding */}
          <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 sm:gap-6 overflow-hidden">
            {/* Vietnamese Text Display */}
            <div className="flex-1 bg-[#111620] rounded-lg p-4 sm:p-6 overflow-y-auto custom-scrollbar border border-gray-800/50">
              <div className="space-y-4 sm:space-y-6">
                {essayData.sections.map((section, idx) => {
                  return (
                    <div key={section.id} className="space-y-2">
                      <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
                        {section.label}
                      </h3>
                      {/* Check if content is outline format (has numbered points like 1 2 3 or bullet points -) */}
                      {section.vn.match(/^\d+\s|^-\s/m) ? (
                        // Outline format - render hierarchical structure
                        <div className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-gray-400 space-y-1">
                          {section.vn.split('\n').filter(line => line.trim()).map((line, lineIdx) => {
                            const trimmedLine = line.trim();
                            // Main point (starts with number)
                            if (trimmedLine.match(/^\d+\s/)) {
                              const num = trimmedLine.match(/^\d+/)?.[0];
                              const text = trimmedLine.replace(/^\d+\s*/, '').trim();
                              return (
                                <div key={lineIdx} className="flex gap-2 mt-2 first:mt-0">
                                  <span className="text-primary font-bold min-w-[18px]">{num}</span>
                                  <span className="font-medium text-gray-300">{text}</span>
                                </div>
                              );
                            }
                            // Sub-point (starts with -)
                            if (trimmedLine.startsWith('-')) {
                              const text = trimmedLine.replace(/^-\s*/, '').trim();
                              return (
                                <div key={lineIdx} className="flex gap-2 pl-6">
                                  <span className="text-gray-500">-</span>
                                  <span className="text-gray-400">{text}</span>
                                </div>
                              );
                            }
                            // Regular text
                            return (
                              <div key={lineIdx} className="text-gray-400">{trimmedLine}</div>
                            );
                          })}
                        </div>
                      ) : (
                        // Full paragraph format - highlight current sentence
                        <p className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-gray-400">
                          {(() => {
                            const vnSentences = section.vn.match(/[^.!?]*[.!?]+/g) || [section.vn];
                            const userSentences = currentText.match(/[^.!?]*[.!?]+/g) || [];
                            const currentSentenceIdx = userSentences.length;

                            return vnSentences.map((sentence, sIdx) => {
                              // Calculate global sentence index across all sections
                              let globalSentenceIndex = 0;
                              for (let i = 0; i < idx; i++) {
                                const prevSentences = essayData.sections[i].vn.match(/[^.!?]*[.!?]+/g) || [essayData.sections[i].vn];
                                globalSentenceIndex += prevSentences.length;
                              }
                              globalSentenceIndex += sIdx;

                              // Highlight sentence that user is currently writing
                              const isHighlighted = globalSentenceIndex === currentSentenceIdx && currentText.length > 0;

                              return (
                                <span key={sIdx} className={isHighlighted ? "text-pink-500 font-semibold" : ""}>
                                  {sentence}
                                </span>
                              );
                            });
                          })()}
                        </p>
                      )}
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

            {/* Mobile Feedback Section - Hiển thị trên mobile, ẩn trên desktop */}
            <div className="lg:hidden">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-gray-200">Feedback</h3>
                {isAnalyzing && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                    <span>Analyzing...</span>
                  </div>
                )}
              </div>
              {feedback ? (
                <div className="bg-[#131823] rounded-lg p-4 border border-gray-800 space-y-4 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {feedback.suggestions && feedback.suggestions.length > 0 && (
                    <div>
                      <p className="text-gray-400 text-xs mb-2 font-medium">Suggested improvements:</p>
                      <ul className="space-y-2">
                        {feedback.suggestions.slice(0, 3).map((s, i) => (
                          <li key={i} className="flex gap-2 text-xs text-gray-300">
                            <span className="w-1 h-1 rounded-full bg-gray-500 mt-1.5 flex-none"></span>
                            <span className="leading-relaxed break-words">
                              {s.error && (
                                <>
                                  <span className="line-through text-red-400">{s.error}</span> →{' '}
                                  <span className="text-primary font-bold">{s.fix}</span>
                                </>
                              )}
                              {s.reason && <><br /><span className="block text-[10px] text-gray-400 mt-1">{s.reason}</span></>}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {feedback.suggestions.length > 3 && (
                        <button
                          onClick={() => setShowSidebar(true)}
                          className="mt-2 text-xs text-primary hover:underline"
                        >
                          Xem thêm {feedback.suggestions.length - 3} gợi ý khác →
                        </button>
                      )}
                    </div>
                  )}
                  {(!feedback.suggestions || feedback.suggestions.length === 0) && (
                    <div className="text-center py-3">
                      <p className="text-xs text-gray-400">Không có gợi ý cải thiện. Bài viết của bạn rất tốt!</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#131823] rounded-lg p-4 border border-gray-800">
                  <p className="text-gray-500 text-xs text-center">
                    {isAnalyzing ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                        Đang phân tích...
                      </span>
                    ) : (
                      "Viết để nhận feedback tự động"
                    )}
                  </p>
                </div>
              )}
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
          </div>{/* End content area */}
        </section>

        {/* Sidebar - Hidden on mobile, toggleable */}
        <aside className={`${showSidebar ? 'fixed flex' : 'hidden'} lg:relative lg:flex w-full lg:w-[400px] h-full lg:h-auto top-0 right-0 z-40 lg:z-auto flex-none bg-[#0e121a] border-l border-gray-800 p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-col gap-4 sm:gap-6`}>
          {/* Close button for mobile */}
          <button
            onClick={() => setShowSidebar(false)}
            className="lg:hidden self-end p-2 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-300 transition-colors mb-2"
            aria-label="Close sidebar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          {/* ========== PHẦN CHƯA HOÀN THÀNH ========== */}
          {/* Chỉ hiện khi chưa hoàn thành (chưa có score) */}
          {!essayScore && (
            <>
              {/* Accuracy & Total Errors */}
              {(() => {
                const errorStats = getTotalErrors();
                return (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className="bg-[#1a212e] rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center gap-1 border border-gray-800">
                      <div className="relative w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border-2 border-green-500 text-green-500 mb-1">
                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-green-500 rounded-full"></div>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-gray-200">{accuracy.toFixed(0)}%</span>
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Accuracy</span>
                    </div>
                    <div className="bg-[#1a212e] rounded-lg p-3 sm:p-4 flex flex-col items-center justify-center gap-1 border border-gray-800">
                      <span className="material-symbols-outlined text-[20px] sm:text-[24px] text-primary">check_circle</span>
                      <span className="text-xs sm:text-sm font-bold text-gray-200">{errorStats.total}</span>
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total Errors</span>
                    </div>
                  </div>
                );
              })()}

              {/* Lỗi đã phát hiện - Chỉ hiển thị khi có lỗi VÀ chưa hoàn thành */}
              {(() => {
                const errorStats = getTotalErrors();
                if (errorStats.allSuggestions.length === 0) return null;

                return (
                  <div className="bg-[#131823] rounded-lg p-3 border border-gray-800">
                    <p className="text-xs text-gray-400 mb-2">
                      Lỗi đã phát hiện ({errorStats.allSuggestions.length})
                    </p>
                    <ul className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {errorStats.allSuggestions.map((s, i) => {
                        const isExpanded = expandedErrorIndex === i;
                        const isGrammar = s.reason?.toLowerCase().includes("ngữ pháp") ||
                          s.reason?.toLowerCase().includes("grammar") ||
                          s.reason?.toLowerCase().includes("cấu trúc") ||
                          s.reason?.toLowerCase().includes("động từ") ||
                          s.reason?.toLowerCase().includes("mạo từ");
                        return (
                          <li
                            key={i}
                            onClick={() => setExpandedErrorIndex(isExpanded ? null : i)}
                            className="p-2 bg-[#1a212e] rounded border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-none ${isGrammar ? 'bg-red-400' : 'bg-orange-400'}`}></span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 flex-wrap text-xs text-gray-300">
                                  <span className="line-through text-red-400 truncate">{s.error}</span>
                                  <span className="text-gray-500">→</span>
                                  <span className="text-primary font-medium truncate">{s.fix}</span>
                                </div>
                                {isExpanded && s.reason && (
                                  <div className="mt-2 pt-2 border-t border-gray-700">
                                    <p className="text-[11px] text-gray-400 leading-relaxed whitespace-normal">
                                      {s.reason}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <span className="material-symbols-outlined text-gray-500 text-sm flex-shrink-0">
                                {isExpanded ? 'expand_less' : 'expand_more'}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}

              {/* Feedback Section - Chỉ hiện khi chưa hoàn thành */}
              <div className="hidden lg:block">
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
                                {s.reason && <><br className="hidden sm:block" /><span className="block sm:inline">{s.reason}</span></>}
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
            </>
          )}

          {/* ========== PHẦN ĐÃ HOÀN THÀNH ========== */}
          {/* Chỉ hiện khi progress >= 100% VÀ AI done */}
          {calculateProgress() >= 100 && !isAnalyzing && (
            <>
              {/* Manual Score Button - Khi chưa có score */}
              {!essayScore && (() => {
                const hasSectionFeedback = Object.values(sectionFeedbacks).some(sf => sf.feedback !== null || sf.suggestions.length > 0);
                const hasGlobalFeedback = feedback !== null;
                const hasAnyFeedback = hasSectionFeedback || hasGlobalFeedback;

                if (!hasAnyFeedback) return null;

                return (
                  <div className="bg-card-dark rounded-xl border border-gray-700/50 p-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-400 mb-3">Bài viết đã hoàn thành!</p>
                      <button
                        onClick={() => {
                          const summaryData = createSummaryFromSections();
                          const score = calculateScore(summaryData, band, certificateId);
                          setEssayScore(score);
                          setSummary(summaryData);
                          setIsCompleted(true);
                          // Save to storage
                          if (currentEssayId && essayData) {
                            const savedEssays = localStorage.getItem('saved_essays');
                            if (savedEssays) {
                              const essays: SavedEssay[] = JSON.parse(savedEssays);
                              const essayIndex = essays.findIndex(e => e.id === currentEssayId);
                              if (essayIndex >= 0) {
                                essays[essayIndex].score = score;
                                essays[essayIndex].summary = summaryData;
                                essays[essayIndex].sectionFeedbacks = sectionFeedbacks;
                                localStorage.setItem('saved_essays', JSON.stringify(essays));
                              }
                            }
                          }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-yellow-400 text-black font-medium rounded-lg transition-colors mx-auto"
                      >
                        <span className="material-symbols-outlined text-base">grade</span>
                        Chấm điểm
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Score Panel - Khi đã có score */}
              {essayScore && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <ScorePanel score={essayScore} />
                </div>
              )}

              {/* Summary Section - Khi đã có score */}
              {essayScore && summary && summary.completedAt && (
                <div className="bg-[#131823] rounded-lg p-4 sm:p-5 border border-gray-800 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
                  <h3 className="text-base sm:text-lg font-bold text-gray-200 mb-3 sm:mb-4">Tổng kết bài viết</h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div className="bg-[#1a212e] rounded p-2 sm:p-3 border border-gray-700">
                        <p className="text-[10px] sm:text-xs text-gray-400 mb-1">Lỗi ngữ pháp</p>
                        <p className="text-base sm:text-lg font-bold text-red-400">{summary.grammarErrors}</p>
                      </div>
                      <div className="bg-[#1a212e] rounded p-2 sm:p-3 border border-gray-700">
                        <p className="text-[10px] sm:text-xs text-gray-400 mb-1">Lỗi từ vựng</p>
                        <p className="text-base sm:text-lg font-bold text-orange-400">{summary.vocabularyErrors}</p>
                      </div>
                    </div>

                    {/* Chi tiết lỗi - click để expand */}
                    {summary.allSuggestions && summary.allSuggestions.length > 0 && (
                      <div>
                        <p className="text-xs sm:text-sm text-gray-400 mb-2 sm:mb-3 font-medium">
                          Chi tiết các lỗi ({summary.allSuggestions.length})
                        </p>
                        <ul className="space-y-2 max-h-64 sm:max-h-80 overflow-y-auto custom-scrollbar">
                          {summary.allSuggestions.map((suggestion, i) => {
                            const isGrammar = suggestion.reason?.toLowerCase().includes("ngữ pháp") ||
                              suggestion.reason?.toLowerCase().includes("grammar") ||
                              suggestion.reason?.toLowerCase().includes("cấu trúc") ||
                              suggestion.reason?.toLowerCase().includes("động từ") ||
                              suggestion.reason?.toLowerCase().includes("mạo từ");
                            const isExpanded = expandedErrorIndex === i;
                            return (
                              <li
                                key={i}
                                onClick={() => setExpandedErrorIndex(isExpanded ? null : i)}
                                className="text-xs sm:text-sm text-gray-300 p-2 sm:p-3 bg-[#1a212e] rounded border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors"
                              >
                                <div className="flex items-start gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-none ${isGrammar ? 'bg-red-400' : 'bg-orange-400'}`}></span>
                                  <div className="flex-1">
                                    {suggestion.error && (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <span className="line-through text-red-400">{suggestion.error}</span>
                                        <span className="text-gray-500">→</span>
                                        <span className="text-primary font-medium">{suggestion.fix}</span>
                                      </div>
                                    )}
                                    {isExpanded && suggestion.reason && (
                                      <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed mt-2 pt-2 border-t border-gray-700">
                                        {suggestion.reason}
                                      </p>
                                    )}
                                  </div>
                                  <span className="material-symbols-outlined text-gray-500 text-sm">
                                    {isExpanded ? 'expand_less' : 'expand_more'}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

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

          {/* Notes Section - LUÔN HIỂN THỊ Ở CUỐI */}
          <div className="bg-[#131823] rounded-lg p-4 sm:p-5 border border-gray-800 mt-auto">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h3 className="text-base sm:text-lg font-bold text-gray-200 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] sm:text-[20px]">note</span>
                Ghi chú cá nhân
              </h3>
            </div>
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Ghi chú những điểm cần nhớ, lỗi sai thường gặp, từ vựng mới..."
              className="w-full h-32 sm:h-40 bg-[#1a212e] border border-gray-700 rounded p-3 text-xs sm:text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary resize-none custom-scrollbar"
            />
            <p className="text-[10px] sm:text-xs text-gray-500 mt-2">Ghi chú sẽ được lưu tự động</p>
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
