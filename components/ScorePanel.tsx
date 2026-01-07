"use client";

import { EssayScore } from "@/types";
import { formatBandScore, getScoreColor } from "@/lib/essay-scorer";

interface ScorePanelProps {
    score: EssayScore;
    onClose?: () => void;
}

export default function ScorePanel({ score, onClose }: ScorePanelProps) {
    const scoreColor = getScoreColor(score.overallBand, score.targetBand);
    const diff = score.targetBand - score.overallBand;

    return (
        <div className="bg-card-dark rounded-xl border border-gray-700/50 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-base">grade</span>
                    Kết quả
                </h4>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                    >
                        <span className="material-symbols-outlined text-gray-500 text-base">close</span>
                    </button>
                )}
            </div>

            {/* Main Score */}
            <div className="text-center mb-4">
                <div className={`text-3xl font-bold ${scoreColor}`}>
                    {formatBandScore(score.overallBand)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                    Mục tiêu: {formatBandScore(score.targetBand)}
                    {diff > 0 && <span className="text-orange-400 ml-1">(-{diff.toFixed(1)})</span>}
                    {diff <= 0 && <span className="text-green-400 ml-1">✓</span>}
                </div>
            </div>

            {/* Score Breakdown */}
            <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Grammar</span>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">{score.grammarErrors} lỗi</span>
                        <span className={getScoreColor(score.grammarScore, score.targetBand)}>
                            {formatBandScore(score.grammarScore)}
                        </span>
                    </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Vocabulary</span>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs">{score.vocabularyErrors} lỗi</span>
                        <span className={getScoreColor(score.vocabularyScore, score.targetBand)}>
                            {formatBandScore(score.vocabularyScore)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Feedback */}
            <div className="bg-background-dark/50 rounded-lg p-3">
                <p className="text-xs text-gray-300 leading-relaxed">
                    {score.feedback}
                </p>
            </div>
        </div>
    );
}
