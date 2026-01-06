"use client";

import { useState } from "react";
import { VocabularyWord, Synonym } from "@/types/flashcard";

interface FlashcardCardProps {
    word: VocabularyWord;
    showPronunciation?: boolean;
    showExample?: boolean;
    onMarkKnown?: () => void;
    onMarkUnknown?: () => void;
    onPrevious?: () => void;
    onNext?: () => void;
    canGoPrevious?: boolean;
    canGoNext?: boolean;
    isFlipped?: boolean;
    onFlip?: () => void;
}

// Badge component for synonym levels
function SynonymBadge({ synonym }: { synonym: Synonym }) {
    const levelColors: Record<string, string> = {
        basic: "bg-gray-600 text-gray-200",
        intermediate: "bg-blue-600 text-blue-100",
        advanced: "bg-purple-600 text-purple-100",
        academic: "bg-amber-600 text-amber-100",
    };

    const levelLabels: Record<string, string> = {
        basic: "Cơ bản",
        intermediate: "Trung cấp",
        advanced: "Nâng cao",
        academic: "Học thuật",
    };

    return (
        <div className="inline-flex items-center gap-2 bg-card-dark/50 rounded-lg px-3 py-1.5 text-sm">
            <span className="font-medium text-text-light">{synonym.word}</span>
            <span
                className={`text-xs px-1.5 py-0.5 rounded ${levelColors[synonym.level]}`}
            >
                {levelLabels[synonym.level]}
            </span>
            {synonym.meaning && (
                <span className="text-gray-400 text-xs">({synonym.meaning})</span>
            )}
        </div>
    );
}

export default function FlashcardCard({
    word,
    showPronunciation = true,
    showExample = true,
    onMarkKnown,
    onMarkUnknown,
    onPrevious,
    onNext,
    canGoPrevious = true,
    canGoNext = true,
    isFlipped: controlledFlipped,
    onFlip,
}: FlashcardCardProps) {
    const [internalFlipped, setInternalFlipped] = useState(false);

    // Use controlled or internal state
    const isFlipped = controlledFlipped !== undefined ? controlledFlipped : internalFlipped;

    const handleFlip = () => {
        if (onFlip) {
            onFlip();
        } else {
            setInternalFlipped(!internalFlipped);
        }
    };

    const partOfSpeechLabels: Record<string, string> = {
        noun: "danh từ",
        verb: "động từ",
        adjective: "tính từ",
        adverb: "trạng từ",
        phrase: "cụm từ",
        other: "khác",
    };

    const difficultyColors: Record<string, string> = {
        beginner: "text-green-400",
        intermediate: "text-yellow-400",
        advanced: "text-red-400",
    };

    const difficultyLabels: Record<string, string> = {
        beginner: "Dễ",
        intermediate: "Trung bình",
        advanced: "Khó",
    };

    return (
        <div className="perspective-1000 w-full max-w-xl mx-auto">
            <div
                className={`relative w-full aspect-[4/3] transition-transform duration-500 transform-style-3d cursor-pointer ${isFlipped ? "rotate-y-180" : ""
                    }`}
                onClick={handleFlip}
            >
                {/* Front of card */}
                <div
                    className={`absolute inset-0 backface-hidden bg-gradient-to-br from-panel-dark to-card-dark rounded-2xl p-6 flex flex-col items-center justify-center shadow-xl border border-gray-700/50 ${isFlipped ? "invisible" : ""
                        }`}
                >
                    {/* Difficulty badge */}
                    <div
                        className={`absolute top-4 right-4 text-xs font-medium ${difficultyColors[word.difficulty]}`}
                    >
                        {difficultyLabels[word.difficulty]}
                    </div>

                    {/* Part of speech */}
                    <div className="absolute top-4 left-4 text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded">
                        {partOfSpeechLabels[word.partOfSpeech]}
                    </div>

                    {/* Main word */}
                    <h2 className="text-4xl md:text-5xl font-bold text-primary mb-4 text-center">
                        {word.word}
                    </h2>

                    {/* Pronunciation */}
                    {showPronunciation && (
                        <p className="text-gray-400 text-lg mb-6">{word.pronunciation}</p>
                    )}

                    {/* Flip hint */}
                    <div className="absolute bottom-4 text-gray-500 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">touch_app</span>
                        Nhấn để lật thẻ
                    </div>
                </div>

                {/* Back of card */}
                <div
                    className={`absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-card-dark to-panel-dark rounded-2xl p-6 flex flex-col shadow-xl border border-gray-700/50 overflow-y-auto custom-scrollbar ${!isFlipped ? "invisible" : ""
                        }`}
                >
                    {/* Word and meaning */}
                    <div className="text-center mb-4">
                        <h3 className="text-2xl font-bold text-primary mb-1">{word.word}</h3>
                        <p className="text-xl text-text-light">{word.meaning}</p>
                        {showPronunciation && (
                            <p className="text-gray-400 text-sm">{word.pronunciation}</p>
                        )}
                    </div>

                    {/* Example sentence */}
                    {showExample && (
                        <div className="bg-background-dark/50 rounded-lg p-3 mb-4">
                            <p className="text-text-light text-sm italic mb-1">
                                &quot;{word.example}&quot;
                            </p>
                            <p className="text-gray-400 text-xs">{word.exampleTranslation}</p>
                        </div>
                    )}

                    {/* Advanced synonyms - the key feature! */}
                    {word.synonyms.length > 0 && (
                        <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-base text-primary">
                                    auto_awesome
                                </span>
                                Từ đồng nghĩa cấp cao hơn
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {word.synonyms.map((synonym, index) => (
                                    <SynonymBadge key={index} synonym={synonym} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tips if available */}
                    {word.tips && (
                        <div className="mt-3 bg-amber-900/20 border border-amber-700/30 rounded-lg p-2">
                            <p className="text-amber-300 text-xs flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">lightbulb</span>
                                {word.tips}
                            </p>
                        </div>
                    )}

                    {/* Flip hint */}
                    <div className="mt-4 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-base">touch_app</span>
                        Nhấn để quay lại
                    </div>
                </div>
            </div>

            {/* Navigation buttons */}
            {(onPrevious || onNext) && (
                <div className="flex justify-center items-center gap-4 mt-6">
                    {onPrevious && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onPrevious();
                            }}
                            disabled={!canGoPrevious}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-colors ${canGoPrevious
                                    ? 'bg-gray-700/50 hover:bg-gray-700 text-gray-300'
                                    : 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
                                }`}
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                            Trước
                        </button>
                    )}
                    {onNext && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onNext();
                            }}
                            disabled={!canGoNext}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-colors ${canGoNext
                                    ? 'bg-gray-700/50 hover:bg-gray-700 text-gray-300'
                                    : 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
                                }`}
                        >
                            Sau
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    )}
                </div>
            )}

            {/* Action buttons */}
            {(onMarkKnown || onMarkUnknown) && (
                <div className="flex justify-center gap-4 mt-4">
                    {onMarkUnknown && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMarkUnknown();
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                            Chưa thuộc
                        </button>
                    )}
                    {onMarkKnown && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onMarkKnown();
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-xl transition-colors"
                        >
                            <span className="material-symbols-outlined">check</span>
                            Đã thuộc
                        </button>
                    )}
                </div>
            )}

            {/* CSS for 3D transforms */}
            <style jsx>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
        </div>
    );
}
