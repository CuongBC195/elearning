"use client";

import { useEffect, useState } from "react";
import { FlashcardStorage, FLASHCARD_STORAGE_KEY, TopicProgress } from "@/types/flashcard";
import { FLASHCARD_TOPICS, getTotalWordCount } from "@/constants/vocabulary";

interface FlashcardProgressProps {
    topicId?: string; // If provided, show progress for specific topic only
    showDetailed?: boolean;
}

export default function FlashcardProgress({
    topicId,
    showDetailed = false,
}: FlashcardProgressProps) {
    const [storage, setStorage] = useState<FlashcardStorage | null>(null);

    useEffect(() => {
        const loadProgress = () => {
            try {
                const stored = localStorage.getItem(FLASHCARD_STORAGE_KEY);
                if (stored) {
                    setStorage(JSON.parse(stored));
                }
            } catch (error) {
                console.error("Error loading progress:", error);
            }
        };

        loadProgress();

        // Listen for storage changes
        window.addEventListener("storage", loadProgress);
        return () => window.removeEventListener("storage", loadProgress);
    }, []);

    // Calculate overall progress
    const calculateOverallProgress = () => {
        if (!storage) {
            return {
                totalWords: getTotalWordCount(),
                masteredWords: 0,
                learningWords: 0,
                newWords: getTotalWordCount(),
                percentage: 0,
            };
        }

        const totalWords = getTotalWordCount();
        const masteredWords = Object.values(storage.wordProgress).filter(
            (p) => p.status === "mastered"
        ).length;
        const learningWords = Object.values(storage.wordProgress).filter(
            (p) => p.status === "learning"
        ).length;

        return {
            totalWords,
            masteredWords,
            learningWords,
            newWords: totalWords - masteredWords - learningWords,
            percentage: Math.round((masteredWords / totalWords) * 100),
        };
    };

    // Calculate topic progress
    const getTopicProgress = (id: string): TopicProgress | null => {
        return storage?.topicProgress[id] || null;
    };

    const overall = calculateOverallProgress();

    // Single topic view
    if (topicId) {
        const topic = FLASHCARD_TOPICS.find((t) => t.id === topicId);
        const progress = getTopicProgress(topicId);

        if (!topic) return null;

        const masteredCount = progress?.masteredWords || 0;
        const learningCount = progress?.learningWords || 0;
        const newCount = topic.wordCount - masteredCount - learningCount;
        const percentage = Math.round((masteredCount / topic.wordCount) * 100);

        return (
            <div className="bg-panel-dark/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">Tiến độ học</span>
                    <span className="text-lg font-bold text-primary">{percentage}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden mb-4">
                    <div className="h-full flex">
                        <div
                            className="bg-green-500 transition-all duration-500"
                            style={{ width: `${(masteredCount / topic.wordCount) * 100}%` }}
                        />
                        <div
                            className="bg-amber-500 transition-all duration-500"
                            style={{ width: `${(learningCount / topic.wordCount) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                        <div className="text-lg font-bold text-green-400">{masteredCount}</div>
                        <div className="text-gray-400">Đã thuộc</div>
                    </div>
                    <div>
                        <div className="text-lg font-bold text-amber-400">{learningCount}</div>
                        <div className="text-gray-400">Đang học</div>
                    </div>
                    <div>
                        <div className="text-lg font-bold text-gray-400">{newCount}</div>
                        <div className="text-gray-400">Chưa học</div>
                    </div>
                </div>

                {progress?.quizHighScore !== undefined && progress.quizHighScore > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-base">emoji_events</span>
                                Điểm quiz cao nhất
                            </span>
                            <span className="text-primary font-medium">{progress.quizHighScore}%</span>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Overview (all topics)
    return (
        <div className="space-y-6">
            {/* Overall stats */}
            <div className="bg-gradient-to-br from-panel-dark to-card-dark rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-text-light mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">analytics</span>
                    Tổng quan tiến độ
                </h3>

                {/* Circular progress */}
                <div className="flex items-center justify-center mb-6">
                    <div className="relative w-32 h-32">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="none"
                                className="text-gray-700"
                            />
                            <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="none"
                                strokeLinecap="round"
                                className="text-primary transition-all duration-1000"
                                strokeDasharray={`${overall.percentage * 3.52} 352`}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-primary">
                                {overall.percentage}
                            </span>
                            <span className="text-xs text-gray-400">%</span>
                        </div>
                    </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-600/20 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-green-400">
                            {overall.masteredWords}
                        </div>
                        <div className="text-xs text-gray-400">Đã thuộc</div>
                    </div>
                    <div className="bg-amber-600/20 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-amber-400">
                            {overall.learningWords}
                        </div>
                        <div className="text-xs text-gray-400">Đang học</div>
                    </div>
                    <div className="bg-gray-600/20 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-gray-400">
                            {overall.newWords}
                        </div>
                        <div className="text-xs text-gray-400">Chưa học</div>
                    </div>
                </div>
            </div>

            {/* Per-topic progress */}
            {showDetailed && (
                <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-400">Theo chủ đề</h4>
                    {FLASHCARD_TOPICS.map((topic) => {
                        const progress = getTopicProgress(topic.id);
                        const masteredCount = progress?.masteredWords || 0;
                        const percentage = Math.round((masteredCount / topic.wordCount) * 100);

                        return (
                            <div
                                key={topic.id}
                                className="bg-panel-dark/50 rounded-xl p-3 flex items-center gap-4"
                            >
                                <div
                                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${topic.color} flex items-center justify-center`}
                                >
                                    <span className="material-symbols-outlined text-white text-lg">
                                        {topic.icon}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium text-text-light truncate">
                                            {topic.nameVi}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {masteredCount}/{topic.wordCount}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full bg-gradient-to-r ${topic.color} transition-all duration-500`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                                <span className="text-sm font-medium text-gray-400">
                                    {percentage}%
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
