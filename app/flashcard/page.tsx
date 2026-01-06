"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FLASHCARD_TOPICS, getTotalWordCount } from "@/constants/vocabulary";
import TopicCard from "@/components/TopicCard";
import FlashcardProgress from "@/components/FlashcardProgress";
import DataManager from "@/components/DataManager";
import CustomVocabForm from "@/components/CustomVocabForm";
import { useToast } from "@/components/Toast";
import { getCustomVocabulary, deleteCustomWord } from "@/lib/custom-vocabulary";
import { CustomVocabularyWord, FlashcardTopic } from "@/types/flashcard";

export default function FlashcardPage() {
    const totalWords = getTotalWordCount();
    const [customWords, setCustomWords] = useState<CustomVocabularyWord[]>([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editWord, setEditWord] = useState<CustomVocabularyWord | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const { showConfirm, showToast } = useToast();

    // Load custom vocabulary
    useEffect(() => {
        setCustomWords(getCustomVocabulary());
    }, [refreshKey]);

    const handleRefresh = () => {
        setRefreshKey((prev) => prev + 1);
    };

    const handleDeleteWord = (id: string) => {
        showConfirm("Bạn có chắc muốn xóa từ này?", () => {
            deleteCustomWord(id);
            handleRefresh();
            showToast("success", "Đã xóa từ vựng thành công");
        });
    };

    // Create custom topic object
    const customTopic: FlashcardTopic | null = customWords.length > 0 ? {
        id: "custom",
        name: "My Vocabulary",
        nameVi: "Từ của tôi",
        description: "Từ vựng bạn tự thêm",
        icon: "edit_note",
        color: "from-pink-500 to-rose-400",
        wordCount: customWords.length,
    } : null;

    return (
        <div className="h-screen flex flex-col bg-background-dark overflow-hidden">
            {/* Header */}
            <header className="flex-shrink-0 sticky top-0 z-50 bg-background-dark/80 backdrop-blur-sm border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
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
                                {totalWords + customWords.length} từ vựng • {FLASHCARD_TOPICS.length + (customWords.length > 0 ? 1 : 0)} chủ đề
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <DataManager onImportComplete={handleRefresh} />
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-7xl mx-auto px-4 py-8">
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
                                {/* Custom vocabulary topic */}
                                {customTopic && (
                                    <Link href="/flashcard/custom">
                                        <TopicCard topic={customTopic} />
                                    </Link>
                                )}

                                {/* Default topics */}
                                {FLASHCARD_TOPICS.map((topic) => (
                                    <Link key={topic.id} href={`/flashcard/${topic.id}`}>
                                        <TopicCard topic={topic} />
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Progress sidebar */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* Custom vocabulary section - moved to top */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-semibold text-text-light flex items-center gap-2">
                                        <span className="material-symbols-outlined text-pink-400">edit_note</span>
                                        Từ của tôi
                                    </h3>
                                    <button
                                        onClick={() => setShowAddForm(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-600/20 hover:bg-pink-600/30 text-pink-400 rounded-lg transition-colors text-sm"
                                    >
                                        <span className="material-symbols-outlined text-base">add</span>
                                        Thêm từ
                                    </button>
                                </div>

                                <div className="bg-panel-dark rounded-xl border border-gray-700/50 divide-y divide-gray-700/50">
                                    {customWords.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 text-sm">
                                            <span className="material-symbols-outlined text-2xl mb-2 block">note_add</span>
                                            Chưa có từ vựng nào
                                        </div>
                                    ) : (
                                        customWords.slice(0, 5).map((word) => (
                                            <div key={word.id} className="p-3 flex items-center justify-between">
                                                <div>
                                                    <span className="text-text-light font-medium">{word.word}</span>
                                                    <span className="text-gray-400 text-sm ml-2">{word.meaning}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => setEditWord(word)}
                                                        className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-gray-400 text-base">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteWord(word.id)}
                                                        className="p-1.5 hover:bg-red-600/20 rounded transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-red-400 text-base">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {customWords.length > 5 && (
                                        <Link
                                            href="/flashcard/custom"
                                            className="block p-3 text-center text-primary hover:bg-primary/10 transition-colors text-sm"
                                        >
                                            Xem tất cả {customWords.length} từ →
                                        </Link>
                                    )}
                                </div>
                            </div>

                            {/* Progress section */}
                            <div>
                                <h3 className="text-lg font-semibold text-text-light mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">trending_up</span>
                                    Tiến độ học
                                </h3>
                                <FlashcardProgress showDetailed />
                            </div>
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

            {/* Add/Edit Form Modal */}
            {(showAddForm || editWord) && (
                <CustomVocabForm
                    editWord={editWord}
                    onClose={() => {
                        setShowAddForm(false);
                        setEditWord(null);
                    }}
                    onSuccess={() => {
                        setShowAddForm(false);
                        setEditWord(null);
                        handleRefresh();
                    }}
                />
            )}
        </div>
    );
}
