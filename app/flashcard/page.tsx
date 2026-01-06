"use client";

import Link from "next/link";
import { FLASHCARD_TOPICS, getTotalWordCount } from "@/constants/vocabulary";
import TopicCard from "@/components/TopicCard";
import FlashcardProgress from "@/components/FlashcardProgress";

export default function FlashcardPage() {
    const totalWords = getTotalWordCount();

    return (
        <div className="h-screen flex flex-col bg-background-dark overflow-hidden">
            {/* Header */}
            <header className="flex-shrink-0 sticky top-0 z-50 bg-background-dark/80 backdrop-blur-sm border-b border-gray-800">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
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
                            <h1 className="text-xl font-bold text-text-light">Flashcard</h1>
                            <p className="text-sm text-gray-400">
                                {totalWords} từ vựng • {FLASHCARD_TOPICS.length} chủ đề
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-6xl mx-auto px-4 py-8">
                    <div className="mb-8">
                        <div className="bg-gradient-to-r from-primary/20 to-amber-500/20 rounded-2xl p-6 border border-primary/30">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-primary text-2xl">
                                        auto_awesome
                                    </span>
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-text-light mb-1">
                                        Học từ vựng thông minh
                                    </h2>
                                    <p className="text-sm text-gray-300">
                                        Mỗi từ vựng đi kèm với <strong className="text-primary">từ đồng nghĩa cấp cao</strong> giúp bạn nâng band điểm IELTS/TOEIC.
                                        Học theo kiểu flashcard hoặc làm quiz để kiểm tra.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Topic list */}
                        <div className="lg:col-span-2">
                            <h3 className="text-lg font-semibold text-text-light mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">category</span>
                                Chọn chủ đề
                            </h3>
                            <div className="grid sm:grid-cols-2 gap-4">
                                {FLASHCARD_TOPICS.map((topic) => (
                                    <Link key={topic.id} href={`/flashcard/${topic.id}`}>
                                        <TopicCard topic={topic} />
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Progress sidebar */}
                        <div className="lg:col-span-1">
                            <h3 className="text-lg font-semibold text-text-light mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">trending_up</span>
                                Tiến độ học
                            </h3>
                            <FlashcardProgress showDetailed />
                        </div>
                    </div>

                    {/* Tips section */}
                    <div className="mt-12 grid sm:grid-cols-3 gap-4">
                        <div className="bg-panel-dark/50 rounded-xl p-4 border border-gray-700/50">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="material-symbols-outlined text-blue-400">school</span>
                                <h4 className="font-medium text-text-light">Flashcard</h4>
                            </div>
                            <p className="text-sm text-gray-400">
                                Lật thẻ để học từ vựng. Đánh dấu từ đã thuộc hoặc cần ôn lại.
                            </p>
                        </div>
                        <div className="bg-panel-dark/50 rounded-xl p-4 border border-gray-700/50">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="material-symbols-outlined text-green-400">quiz</span>
                                <h4 className="font-medium text-text-light">Quiz</h4>
                            </div>
                            <p className="text-sm text-gray-400">
                                Kiểm tra kiến thức với câu hỏi trắc nghiệm. Xem lại các từ sai.
                            </p>
                        </div>
                        <div className="bg-panel-dark/50 rounded-xl p-4 border border-gray-700/50">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="material-symbols-outlined text-purple-400">auto_awesome</span>
                                <h4 className="font-medium text-text-light">Advanced Synonyms</h4>
                            </div>
                            <p className="text-sm text-gray-400">
                                Học từ đồng nghĩa cấp cao để nâng band điểm IELTS/TOEIC.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
