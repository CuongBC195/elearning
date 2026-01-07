"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SavedEssay } from "@/types";
import { formatBandScore, getScoreColor } from "@/lib/essay-scorer";

export default function ProgressPage() {
    const [essays, setEssays] = useState<SavedEssay[]>([]);
    const [scoredEssays, setScoredEssays] = useState<SavedEssay[]>([]);

    useEffect(() => {
        const savedEssays = localStorage.getItem("saved_essays");
        if (savedEssays) {
            try {
                const parsed: SavedEssay[] = JSON.parse(savedEssays);
                setEssays(parsed);
                // Filter essays with scores
                const withScores = parsed.filter(e => e.score).sort((a, b) =>
                    (b.score?.scoredAt || 0) - (a.score?.scoredAt || 0)
                );
                setScoredEssays(withScores);
            } catch (e) {
                console.error("Error loading essays:", e);
            }
        }
    }, []);

    // Calculate stats
    const avgScore = scoredEssays.length > 0
        ? scoredEssays.reduce((sum, e) => sum + (e.score?.overallBand || 0), 0) / scoredEssays.length
        : 0;

    const bestScore = scoredEssays.length > 0
        ? Math.max(...scoredEssays.map(e => e.score?.overallBand || 0))
        : 0;

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    };

    return (
        <div className="min-h-screen bg-background-dark">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-sm border-b border-gray-800">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined text-gray-400">
                                arrow_back
                            </span>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-text-light">Tiến độ học</h1>
                            <p className="text-sm text-gray-400">
                                {scoredEssays.length} bài đã chấm điểm
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {scoredEssays.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800 mb-4">
                            <span className="material-symbols-outlined text-4xl text-gray-500">analytics</span>
                        </div>
                        <p className="text-gray-400 text-lg mb-2">Chưa có bài viết nào được chấm điểm</p>
                        <p className="text-gray-500 text-sm mb-6">Hoàn thành bài viết 100% để xem điểm</p>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined">edit</span>
                            Viết bài mới
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            <div className="bg-card-dark rounded-xl p-4 border border-gray-700/50">
                                <p className="text-xs text-gray-500 mb-1">Tổng bài</p>
                                <p className="text-2xl font-bold text-text-light">{scoredEssays.length}</p>
                            </div>
                            <div className="bg-card-dark rounded-xl p-4 border border-gray-700/50">
                                <p className="text-xs text-gray-500 mb-1">Điểm TB</p>
                                <p className="text-2xl font-bold text-primary">{formatBandScore(Math.round(avgScore * 2) / 2)}</p>
                            </div>
                            <div className="bg-card-dark rounded-xl p-4 border border-gray-700/50">
                                <p className="text-xs text-gray-500 mb-1">Cao nhất</p>
                                <p className="text-2xl font-bold text-green-400">{formatBandScore(bestScore)}</p>
                            </div>
                        </div>

                        {/* Score History */}
                        <h2 className="text-lg font-semibold text-text-light mb-4">Lịch sử điểm</h2>
                        <div className="space-y-3">
                            {scoredEssays.map((essay) => (
                                <Link
                                    key={essay.id}
                                    href="/"
                                    className="block bg-card-dark rounded-xl p-4 border border-gray-700/50 hover:border-gray-600 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <h3 className="font-medium text-text-light truncate mb-1">
                                                {essay.title}
                                            </h3>
                                            <p className="text-xs text-gray-500">
                                                {formatDate(essay.score?.scoredAt || essay.updatedAt)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-xl font-bold ${getScoreColor(essay.score?.overallBand || 0, essay.score?.targetBand || 0)}`}>
                                                {formatBandScore(essay.score?.overallBand || 0)}
                                            </span>
                                            <p className="text-xs text-gray-500">
                                                / {formatBandScore(essay.score?.targetBand || 0)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Mini breakdown */}
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-400">
                                        <span>Grammar: {essay.score?.grammarScore}</span>
                                        <span>Vocab: {essay.score?.vocabularyScore}</span>
                                        <span className="text-gray-600">
                                            {essay.score?.grammarErrors} + {essay.score?.vocabularyErrors} lỗi
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
