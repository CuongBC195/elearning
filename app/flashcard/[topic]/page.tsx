"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getTopicById, getVocabularyByTopic } from "@/constants/vocabulary";
import { VocabularyWord, FlashcardTopic } from "@/types/flashcard";
import FlashcardViewer from "@/components/FlashcardViewer";
import FlashcardQuiz from "@/components/FlashcardQuiz";
import FlashcardProgress from "@/components/FlashcardProgress";

type StudyMode = "select" | "learn" | "quiz";

export default function TopicStudyPage() {
    const params = useParams();
    const router = useRouter();
    const topicId = params.topic as string;

    const [topic, setTopic] = useState<FlashcardTopic | null>(null);
    const [words, setWords] = useState<VocabularyWord[]>([]);
    const [mode, setMode] = useState<StudyMode>("select");
    const [quizQuestionCount, setQuizQuestionCount] = useState(10);

    useEffect(() => {
        if (topicId) {
            const foundTopic = getTopicById(topicId);
            if (foundTopic) {
                setTopic(foundTopic);
                setWords(getVocabularyByTopic(topicId));
            } else {
                router.push("/flashcard");
            }
        }
    }, [topicId, router]);

    if (!topic) {
        return (
            <div className="min-h-screen bg-background-dark flex items-center justify-center">
                <div className="text-center text-gray-400">
                    <span className="material-symbols-outlined text-4xl mb-2 animate-spin">
                        progress_activity
                    </span>
                    <p>Đang tải...</p>
                </div>
            </div>
        );
    }

    // Mode selection screen
    if (mode === "select") {
        return (
            <div className="min-h-screen bg-background-dark">
                {/* Header */}
                <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-sm border-b border-gray-800">
                    <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                        <Link
                            href="/flashcard"
                            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined text-gray-400">
                                arrow_back
                            </span>
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-text-light">{topic.nameVi}</h1>
                            <p className="text-sm text-gray-400">{topic.name}</p>
                        </div>
                    </div>
                </header>

                <main className="max-w-4xl mx-auto px-4 py-8">
                    {/* Topic info */}
                    <div className="mb-8">
                        <div
                            className={`flex items-center gap-4 p-6 bg-gradient-to-r ${topic.color} bg-opacity-20 rounded-2xl`}
                        >
                            <div
                                className={`w-16 h-16 rounded-xl bg-gradient-to-br ${topic.color} flex items-center justify-center shadow-lg`}
                            >
                                <span className="material-symbols-outlined text-white text-3xl">
                                    {topic.icon}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-text-light mb-1">
                                    {topic.nameVi}
                                </h2>
                                <p className="text-gray-300">{topic.description}</p>
                                <p className="text-sm text-gray-400 mt-1">
                                    {topic.wordCount} từ vựng
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Study modes */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-text-light flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">
                                    play_circle
                                </span>
                                Chọn chế độ học
                            </h3>

                            {/* Learn mode */}
                            <button
                                onClick={() => setMode("learn")}
                                className="w-full bg-gradient-to-br from-panel-dark to-card-dark rounded-xl p-5 text-left border border-gray-700/50 hover:border-blue-500/50 transition-all group"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                                        <span className="material-symbols-outlined text-blue-400 text-2xl">
                                            school
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-text-light mb-1 group-hover:text-blue-400 transition-colors">
                                            Học Flashcard
                                        </h4>
                                        <p className="text-sm text-gray-400">
                                            Lật thẻ để học từ vựng. Xem nghĩa, ví dụ, và từ đồng nghĩa cấp cao.
                                        </p>
                                    </div>
                                    <span className="material-symbols-outlined text-gray-500 group-hover:text-blue-400 transition-colors">
                                        arrow_forward
                                    </span>
                                </div>
                            </button>

                            {/* Quiz mode */}
                            <button
                                onClick={() => setMode("quiz")}
                                className="w-full bg-gradient-to-br from-panel-dark to-card-dark rounded-xl p-5 text-left border border-gray-700/50 hover:border-green-500/50 transition-all group"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-green-600/20 flex items-center justify-center group-hover:bg-green-600/30 transition-colors">
                                        <span className="material-symbols-outlined text-green-400 text-2xl">
                                            quiz
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-text-light mb-1 group-hover:text-green-400 transition-colors">
                                            Làm Quiz
                                        </h4>
                                        <p className="text-sm text-gray-400">
                                            Kiểm tra kiến thức với câu hỏi trắc nghiệm (10-20 câu).
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-gray-500">Số câu:</span>
                                            <div className="flex gap-1">
                                                {[10, 15, 20].map((count) => (
                                                    <button
                                                        key={count}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setQuizQuestionCount(count);
                                                        }}
                                                        className={`px-2 py-0.5 text-xs rounded ${quizQuestionCount === count
                                                                ? "bg-green-600 text-white"
                                                                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                                                            }`}
                                                    >
                                                        {count}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-gray-500 group-hover:text-green-400 transition-colors">
                                        arrow_forward
                                    </span>
                                </div>
                            </button>
                        </div>

                        {/* Progress */}
                        <div>
                            <h3 className="text-lg font-semibold text-text-light mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">
                                    analytics
                                </span>
                                Tiến độ của bạn
                            </h3>
                            <FlashcardProgress topicId={topicId} />

                            {/* Word preview */}
                            <div className="mt-6">
                                <h4 className="text-sm font-medium text-gray-400 mb-3">
                                    Một số từ trong chủ đề
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {words.slice(0, 12).map((word) => (
                                        <span
                                            key={word.id}
                                            className="text-sm bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full"
                                        >
                                            {word.word}
                                        </span>
                                    ))}
                                    {words.length > 12 && (
                                        <span className="text-sm text-gray-500 px-3 py-1">
                                            +{words.length - 12} từ khác
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Learn mode
    if (mode === "learn") {
        return (
            <div className="min-h-screen bg-background-dark">
                <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-sm border-b border-gray-800">
                    <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                        <button
                            onClick={() => setMode("select")}
                            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined text-gray-400">
                                close
                            </span>
                        </button>
                        <div className="flex-1">
                            <h1 className="text-lg font-bold text-text-light">
                                Học Flashcard
                            </h1>
                            <p className="text-sm text-gray-400">{topic.nameVi}</p>
                        </div>
                    </div>
                </header>

                <main className="py-6">
                    <FlashcardViewer
                        words={words}
                        topicId={topicId}
                        onBack={() => setMode("select")}
                    />
                </main>
            </div>
        );
    }

    // Quiz mode
    if (mode === "quiz") {
        return (
            <div className="min-h-screen bg-background-dark">
                <header className="sticky top-0 z-50 bg-background-dark/80 backdrop-blur-sm border-b border-gray-800">
                    <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                        <button
                            onClick={() => setMode("select")}
                            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined text-gray-400">
                                close
                            </span>
                        </button>
                        <div className="flex-1">
                            <h1 className="text-lg font-bold text-text-light">Quiz</h1>
                            <p className="text-sm text-gray-400">{topic.nameVi}</p>
                        </div>
                    </div>
                </header>

                <main className="py-6">
                    <FlashcardQuiz
                        words={words}
                        topicId={topicId}
                        questionCount={quizQuestionCount}
                        onBack={() => setMode("select")}
                    />
                </main>
            </div>
        );
    }

    return null;
}
