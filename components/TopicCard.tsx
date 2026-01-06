"use client";

import { useEffect, useState } from "react";
import { FlashcardTopic, FlashcardStorage, FLASHCARD_STORAGE_KEY } from "@/types/flashcard";

interface TopicCardProps {
    topic: FlashcardTopic;
    onClick?: () => void;
}

export default function TopicCard({ topic, onClick }: TopicCardProps) {
    const [progress, setProgress] = useState({
        masteredWords: 0,
        percentage: 0,
    });

    useEffect(() => {
        try {
            const stored = localStorage.getItem(FLASHCARD_STORAGE_KEY);
            if (stored) {
                const data: FlashcardStorage = JSON.parse(stored);
                const topicProgress = data.topicProgress[topic.id];
                if (topicProgress) {
                    const masteredWords = topicProgress.masteredWords || 0;
                    setProgress({
                        masteredWords,
                        percentage: Math.round((masteredWords / topic.wordCount) * 100),
                    });
                }
            }
        } catch (error) {
            console.error("Error loading progress:", error);
        }
    }, [topic.id, topic.wordCount]);

    return (
        <button
            onClick={onClick}
            className="group relative w-full bg-gradient-to-br from-panel-dark to-card-dark rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border border-gray-700/50 hover:border-gray-600/50 overflow-hidden"
        >
            {/* Background gradient overlay */}
            <div
                className={`absolute inset-0 bg-gradient-to-br ${topic.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
            />

            {/* Icon */}
            <div
                className={`w-14 h-14 rounded-xl bg-gradient-to-br ${topic.color} flex items-center justify-center mb-4 shadow-lg`}
            >
                <span className="material-symbols-outlined text-white text-2xl">
                    {topic.icon}
                </span>
            </div>

            {/* Content */}
            <h3 className="text-lg font-semibold text-text-light mb-1">
                {topic.nameVi}
            </h3>
            <p className="text-sm text-gray-400 mb-1">{topic.name}</p>
            <p className="text-xs text-gray-500 line-clamp-2 mb-4">
                {topic.description}
            </p>

            {/* Word count */}
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                    {topic.wordCount} từ vựng
                </span>
                {progress.percentage > 0 && (
                    <span className="text-primary font-medium">
                        {progress.percentage}%
                    </span>
                )}
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`h-full bg-gradient-to-r ${topic.color} transition-all duration-500`}
                    style={{ width: `${progress.percentage}%` }}
                />
            </div>

            {/* Hover arrow */}
            <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                <span className="material-symbols-outlined text-gray-400">
                    arrow_forward
                </span>
            </div>
        </button>
    );
}
