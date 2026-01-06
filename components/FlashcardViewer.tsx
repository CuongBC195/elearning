"use client";

import { useState, useEffect, useCallback } from "react";
import { VocabularyWord, WordProgress, FlashcardStorage, FLASHCARD_STORAGE_KEY, DEFAULT_FLASHCARD_SETTINGS } from "@/types/flashcard";
import FlashcardCard from "./FlashcardCard";

interface FlashcardViewerProps {
    words: VocabularyWord[];
    topicId: string;
    onComplete?: (masteredCount: number, totalCount: number) => void;
    onBack?: () => void;
}

export default function FlashcardViewer({
    words,
    topicId,
    onComplete,
    onBack,
}: FlashcardViewerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [shuffledWords, setShuffledWords] = useState<VocabularyWord[]>([]);
    const [sessionProgress, setSessionProgress] = useState<{
        known: string[];
        unknown: string[];
    }>({ known: [], unknown: [] });
    const [isCompleted, setIsCompleted] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Initialize and shuffle words
    useEffect(() => {
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        setShuffledWords(shuffled);
        setCurrentIndex(0);
        setIsFlipped(false);
        setSessionProgress({ known: [], unknown: [] });
        setIsCompleted(false);
    }, [words]);

    // Load and save progress to localStorage
    const saveProgress = useCallback(
        (wordId: string, isKnown: boolean) => {
            try {
                const stored = localStorage.getItem(FLASHCARD_STORAGE_KEY);
                const data: FlashcardStorage = stored
                    ? JSON.parse(stored)
                    : {
                        wordProgress: {},
                        topicProgress: {},
                        quizHistory: [],
                        settings: DEFAULT_FLASHCARD_SETTINGS,
                        lastUpdated: Date.now(),
                    };

                // Update word progress
                const existingProgress = data.wordProgress[wordId] || {
                    wordId,
                    status: "new",
                    correctCount: 0,
                    incorrectCount: 0,
                    lastStudied: 0,
                    nextReview: 0,
                };

                const newProgress: WordProgress = {
                    ...existingProgress,
                    status: isKnown ? "mastered" : "learning",
                    correctCount: isKnown
                        ? existingProgress.correctCount + 1
                        : existingProgress.correctCount,
                    incorrectCount: !isKnown
                        ? existingProgress.incorrectCount + 1
                        : existingProgress.incorrectCount,
                    lastStudied: Date.now(),
                    nextReview: Date.now() + (isKnown ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000), // 24h if known, 1h if unknown
                };

                data.wordProgress[wordId] = newProgress;

                // Update topic progress
                const topicWords = words.map((w) => w.id);
                const masteredWords = topicWords.filter(
                    (id) => data.wordProgress[id]?.status === "mastered"
                ).length;
                const learningWords = topicWords.filter(
                    (id) => data.wordProgress[id]?.status === "learning"
                ).length;

                data.topicProgress[topicId] = {
                    topicId,
                    totalWords: words.length,
                    newWords: words.length - masteredWords - learningWords,
                    learningWords,
                    masteredWords,
                    lastStudied: Date.now(),
                    totalStudyTime: (data.topicProgress[topicId]?.totalStudyTime || 0) + 1,
                    quizHighScore: data.topicProgress[topicId]?.quizHighScore || 0,
                };

                data.lastUpdated = Date.now();
                localStorage.setItem(FLASHCARD_STORAGE_KEY, JSON.stringify(data));
            } catch (error) {
                console.error("Error saving progress:", error);
            }
        },
        [topicId, words]
    );

    const handleMarkKnown = () => {
        const currentWord = shuffledWords[currentIndex];
        if (!currentWord) return;

        saveProgress(currentWord.id, true);
        setSessionProgress((prev) => ({
            ...prev,
            known: [...prev.known, currentWord.id],
        }));

        goToNext();
    };

    const handleMarkUnknown = () => {
        const currentWord = shuffledWords[currentIndex];
        if (!currentWord) return;

        saveProgress(currentWord.id, false);
        setSessionProgress((prev) => ({
            ...prev,
            unknown: [...prev.unknown, currentWord.id],
        }));

        goToNext();
    };

    const goToNext = () => {
        setIsFlipped(false);
        if (currentIndex < shuffledWords.length - 1) {
            setTimeout(() => {
                setCurrentIndex((prev) => prev + 1);
            }, 200);
        } else {
            setIsCompleted(true);
            onComplete?.(sessionProgress.known.length + 1, shuffledWords.length);
        }
    };

    const goToPrevious = () => {
        if (currentIndex > 0) {
            setIsFlipped(false);
            setCurrentIndex((prev) => prev - 1);
        }
    };

    const restartSession = () => {
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        setShuffledWords(shuffled);
        setCurrentIndex(0);
        setIsFlipped(false);
        setSessionProgress({ known: [], unknown: [] });
        setIsCompleted(false);
    };

    const reviewUnknown = () => {
        const unknownWords = words.filter((w) =>
            sessionProgress.unknown.includes(w.id)
        );
        if (unknownWords.length > 0) {
            setShuffledWords(unknownWords.sort(() => Math.random() - 0.5));
            setCurrentIndex(0);
            setIsFlipped(false);
            setSessionProgress({ known: [], unknown: [] });
            setIsCompleted(false);
        }
    };

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isCompleted) return;

            switch (e.key) {
                case " ":
                case "Enter":
                    e.preventDefault();
                    setIsFlipped((prev) => !prev);
                    break;
                case "ArrowRight":
                    if (isFlipped) handleMarkKnown();
                    break;
                case "ArrowLeft":
                    if (isFlipped) handleMarkUnknown();
                    break;
                case "ArrowUp":
                    goToPrevious();
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentIndex, isFlipped, isCompleted, shuffledWords]);

    if (shuffledWords.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center text-gray-400">
                    <span className="material-symbols-outlined text-4xl mb-2">
                        hourglass_empty
                    </span>
                    <p>Đang tải...</p>
                </div>
            </div>
        );
    }

    // Completion screen
    if (isCompleted) {
        const knownPercentage = Math.round(
            (sessionProgress.known.length / shuffledWords.length) * 100
        );

        return (
            <div className="max-w-xl mx-auto p-6">
                <div className="bg-gradient-to-br from-panel-dark to-card-dark rounded-2xl p-8 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 bg-primary/20 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-primary">
                            celebration
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-text-light mb-2">
                        Hoàn thành phiên học!
                    </h2>
                    <p className="text-gray-400 mb-6">
                        Bạn đã học xong {shuffledWords.length} từ vựng
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-green-600/20 rounded-xl p-4">
                            <div className="text-3xl font-bold text-green-400">
                                {sessionProgress.known.length}
                            </div>
                            <div className="text-sm text-gray-400">Đã thuộc</div>
                        </div>
                        <div className="bg-red-600/20 rounded-xl p-4">
                            <div className="text-3xl font-bold text-red-400">
                                {sessionProgress.unknown.length}
                            </div>
                            <div className="text-sm text-gray-400">Cần ôn lại</div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-8">
                        <div className="flex justify-between text-sm text-gray-400 mb-2">
                            <span>Tiến độ</span>
                            <span>{knownPercentage}%</span>
                        </div>
                        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                                style={{ width: `${knownPercentage}%` }}
                            />
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-3">
                        {sessionProgress.unknown.length > 0 && (
                            <button
                                onClick={reviewUnknown}
                                className="w-full py-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">refresh</span>
                                Ôn lại {sessionProgress.unknown.length} từ chưa thuộc
                            </button>
                        )}
                        <button
                            onClick={restartSession}
                            className="w-full py-3 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">replay</span>
                            Học lại từ đầu
                        </button>
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="w-full py-3 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">arrow_back</span>
                                Quay lại
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const currentWord = shuffledWords[currentIndex];

    return (
        <div className="max-w-2xl mx-auto p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined text-gray-400">
                            arrow_back
                        </span>
                    </button>
                )}

                {/* Progress indicator */}
                <div className="flex-1 mx-4">
                    <div className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>
                            {currentIndex + 1} / {shuffledWords.length}
                        </span>
                        <span>
                            <span className="text-green-400">{sessionProgress.known.length}</span>
                            {" | "}
                            <span className="text-red-400">{sessionProgress.unknown.length}</span>
                        </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-300"
                            style={{
                                width: `${((currentIndex + 1) / shuffledWords.length) * 100}%`,
                            }}
                        />
                    </div>
                </div>

                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                >
                    <span className="material-symbols-outlined text-gray-400">
                        settings
                    </span>
                </button>
            </div>

            {/* Flashcard */}
            <FlashcardCard
                word={currentWord}
                isFlipped={isFlipped}
                onFlip={() => setIsFlipped(!isFlipped)}
                onMarkKnown={handleMarkKnown}
                onMarkUnknown={handleMarkUnknown}
            />

            {/* Navigation hints */}
            <div className="mt-6 flex justify-center gap-6 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">Space</kbd>
                    <span>Lật thẻ</span>
                </div>
                <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">←</kbd>
                    <span>Chưa thuộc</span>
                </div>
                <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">→</kbd>
                    <span>Đã thuộc</span>
                </div>
            </div>
        </div>
    );
}
