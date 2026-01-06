"use client";

import { useEffect, useState } from "react";
import { FlashcardTopic, FlashcardStorage, FLASHCARD_STORAGE_KEY } from "@/types/flashcard";

interface TopicCardProps {
    topic: FlashcardTopic;
    onClick?: () => void;
}

// Map topic.color class to actual CSS gradient for inline styles
const COLOR_MAP: { [key: string]: { from: string; to: string } } = {
    "from-blue-500 to-cyan-400": { from: "#3b82f6", to: "#22d3ee" },
    "from-red-500 to-pink-400": { from: "#ef4444", to: "#f472b6" },
    "from-purple-500 to-violet-400": { from: "#a855f7", to: "#a78bfa" },
    "from-amber-500 to-yellow-400": { from: "#f59e0b", to: "#facc15" },
    "from-green-500 to-emerald-400": { from: "#22c55e", to: "#34d399" },
    "from-indigo-500 to-blue-400": { from: "#6366f1", to: "#60a5fa" },
};

function getGradientStyle(colorClass: string): React.CSSProperties {
    const colors = COLOR_MAP[colorClass];
    if (colors) {
        return {
            background: `linear-gradient(to bottom right, ${colors.from}, ${colors.to})`,
        };
    }
    return {};
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

    const gradientStyle = getGradientStyle(topic.color);

    return (
        <button
            onClick={onClick}
            className="group relative w-full bg-gradient-to-br from-panel-dark to-card-dark rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border border-gray-700/50 hover:border-gray-600/50 overflow-hidden"
        >
            {/* Background gradient overlay - using inline style for dynamic colors */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-40 transition-opacity duration-300"
                style={gradientStyle}
            />

            {/* Icon - using inline style for dynamic colors */}
            <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 shadow-lg"
                style={gradientStyle}
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
                    className="h-full transition-all duration-500"
                    style={{
                        width: `${progress.percentage}%`,
                        ...gradientStyle,
                    }}
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
