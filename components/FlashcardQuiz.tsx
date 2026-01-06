"use client";

import { useState, useEffect, useCallback } from "react";
import { VocabularyWord, QuizQuestion, QuizResult, FlashcardStorage, FLASHCARD_STORAGE_KEY, DEFAULT_FLASHCARD_SETTINGS } from "@/types/flashcard";

interface FlashcardQuizProps {
    words: VocabularyWord[];
    topicId: string;
    questionCount?: number;
    onComplete?: (result: QuizResult) => void;
    onBack?: () => void;
}

// Generate quiz questions from vocabulary
function generateQuestions(
    words: VocabularyWord[],
    count: number
): QuizQuestion[] {
    const shuffledWords = [...words].sort(() => Math.random() - 0.5);
    const selectedWords = shuffledWords.slice(0, Math.min(count, words.length));

    return selectedWords.map((word, index) => {
        // Randomly choose question type
        const questionTypes: QuizQuestion["questionType"][] = [
            "word-to-meaning",
            "meaning-to-word",
            "synonym",
        ];
        const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];

        let question: string;
        let correctAnswer: string;
        let wrongAnswers: string[];

        switch (questionType) {
            case "word-to-meaning":
                question = `"${word.word}" có nghĩa là gì?`;
                correctAnswer = word.meaning;
                // Get wrong meanings from other words
                wrongAnswers = shuffledWords
                    .filter((w) => w.id !== word.id)
                    .slice(0, 3)
                    .map((w) => w.meaning);
                break;

            case "meaning-to-word":
                question = `Từ nào có nghĩa "${word.meaning}"?`;
                correctAnswer = word.word;
                wrongAnswers = shuffledWords
                    .filter((w) => w.id !== word.id)
                    .slice(0, 3)
                    .map((w) => w.word);
                break;

            case "synonym":
                const synonym =
                    word.synonyms[Math.floor(Math.random() * word.synonyms.length)];
                if (synonym) {
                    question = `Từ nào là đồng nghĩa với "${word.word}"?`;
                    correctAnswer = synonym.word;
                    // Get random words as wrong answers
                    wrongAnswers = shuffledWords
                        .filter((w) => w.id !== word.id)
                        .flatMap((w) => w.synonyms.map((s) => s.word))
                        .filter((s) => s !== synonym.word)
                        .slice(0, 3);
                    // If not enough synonyms, add some words
                    while (wrongAnswers.length < 3) {
                        const randomWord = shuffledWords[Math.floor(Math.random() * shuffledWords.length)];
                        if (randomWord.word !== word.word && !wrongAnswers.includes(randomWord.word)) {
                            wrongAnswers.push(randomWord.word);
                        }
                    }
                } else {
                    // Fallback to word-to-meaning if no synonyms
                    question = `"${word.word}" có nghĩa là gì?`;
                    correctAnswer = word.meaning;
                    wrongAnswers = shuffledWords
                        .filter((w) => w.id !== word.id)
                        .slice(0, 3)
                        .map((w) => w.meaning);
                }
                break;

            default:
                question = `"${word.word}" có nghĩa là gì?`;
                correctAnswer = word.meaning;
                wrongAnswers = shuffledWords
                    .filter((w) => w.id !== word.id)
                    .slice(0, 3)
                    .map((w) => w.meaning);
        }

        // Shuffle options
        const options = [correctAnswer, ...wrongAnswers].sort(
            () => Math.random() - 0.5
        );

        return {
            id: `q_${index}`,
            word,
            questionType,
            question,
            options,
            correctAnswer,
            correctIndex: options.indexOf(correctAnswer),
        };
    });
}

export default function FlashcardQuiz({
    words,
    topicId,
    questionCount = 10,
    onComplete,
    onBack,
}: FlashcardQuizProps) {
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState({ correct: 0, incorrect: 0 });
    const [wrongWords, setWrongWords] = useState<string[]>([]);
    const [isCompleted, setIsCompleted] = useState(false);
    const [startTime] = useState(Date.now());
    const [showExplanation, setShowExplanation] = useState(false);

    // Generate questions on mount
    useEffect(() => {
        const generatedQuestions = generateQuestions(words, questionCount);
        setQuestions(generatedQuestions);
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setScore({ correct: 0, incorrect: 0 });
        setWrongWords([]);
        setIsCompleted(false);
    }, [words, questionCount]);

    // Save quiz result to localStorage
    const saveQuizResult = useCallback(
        (result: QuizResult) => {
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

                // Add to quiz history
                data.quizHistory.push(result);

                // Update topic progress high score
                if (data.topicProgress[topicId]) {
                    if (result.score > (data.topicProgress[topicId].quizHighScore || 0)) {
                        data.topicProgress[topicId].quizHighScore = result.score;
                    }
                }

                // Update word progress for wrong answers
                result.wrongWords.forEach((wordId) => {
                    const existing = data.wordProgress[wordId] || {
                        wordId,
                        status: "new",
                        correctCount: 0,
                        incorrectCount: 0,
                        lastStudied: 0,
                        nextReview: 0,
                    };
                    data.wordProgress[wordId] = {
                        ...existing,
                        status: "learning",
                        incorrectCount: existing.incorrectCount + 1,
                        lastStudied: Date.now(),
                        nextReview: Date.now() + 30 * 60 * 1000, // Review in 30 minutes
                    };
                });

                data.lastUpdated = Date.now();
                localStorage.setItem(FLASHCARD_STORAGE_KEY, JSON.stringify(data));
            } catch (error) {
                console.error("Error saving quiz result:", error);
            }
        },
        [topicId]
    );

    const handleSelectAnswer = (index: number) => {
        if (isAnswered) return;

        setSelectedAnswer(index);
        setIsAnswered(true);
        setShowExplanation(true);

        const currentQuestion = questions[currentIndex];
        const isCorrect = index === currentQuestion.correctIndex;

        if (isCorrect) {
            setScore((prev) => ({ ...prev, correct: prev.correct + 1 }));
        } else {
            setScore((prev) => ({ ...prev, incorrect: prev.incorrect + 1 }));
            setWrongWords((prev) => [...prev, currentQuestion.word.id]);
        }
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex((prev) => prev + 1);
            setSelectedAnswer(null);
            setIsAnswered(false);
            setShowExplanation(false);
        } else {
            // Quiz completed
            const endTime = Date.now();
            const finalScore = Math.round(
                ((score.correct + (selectedAnswer === questions[currentIndex]?.correctIndex ? 1 : 0)) /
                    questions.length) *
                100
            );

            const result: QuizResult = {
                topicId,
                totalQuestions: questions.length,
                correctAnswers:
                    score.correct + (selectedAnswer === questions[currentIndex]?.correctIndex ? 1 : 0),
                incorrectAnswers: score.incorrect,
                score: finalScore,
                completedAt: endTime,
                timeSpent: Math.round((endTime - startTime) / 1000),
                wrongWords,
            };

            saveQuizResult(result);
            setIsCompleted(true);
            onComplete?.(result);
        }
    };

    const restartQuiz = () => {
        const generatedQuestions = generateQuestions(words, questionCount);
        setQuestions(generatedQuestions);
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setScore({ correct: 0, incorrect: 0 });
        setWrongWords([]);
        setIsCompleted(false);
    };

    if (questions.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center text-gray-400">
                    <span className="material-symbols-outlined text-4xl mb-2 animate-spin">
                        progress_activity
                    </span>
                    <p>Đang tạo câu hỏi...</p>
                </div>
            </div>
        );
    }

    // Completion screen
    if (isCompleted) {
        const finalScore = Math.round((score.correct / questions.length) * 100);
        const isPassing = finalScore >= 70;

        return (
            <div className="max-w-xl mx-auto p-6">
                <div className="bg-gradient-to-br from-panel-dark to-card-dark rounded-2xl p-8 text-center">
                    <div
                        className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center ${isPassing ? "bg-green-600/20" : "bg-amber-600/20"
                            }`}
                    >
                        <span
                            className={`material-symbols-outlined text-5xl ${isPassing ? "text-green-400" : "text-amber-400"
                                }`}
                        >
                            {isPassing ? "emoji_events" : "sentiment_neutral"}
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-text-light mb-2">
                        {isPassing ? "Xuất sắc!" : "Cần cố gắng thêm!"}
                    </h2>

                    {/* Score display */}
                    <div className="text-6xl font-bold mb-2">
                        <span
                            className={isPassing ? "text-green-400" : "text-amber-400"}
                        >
                            {finalScore}
                        </span>
                        <span className="text-2xl text-gray-400">%</span>
                    </div>
                    <p className="text-gray-400 mb-6">
                        {score.correct} / {questions.length} câu đúng
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-green-600/20 rounded-xl p-3">
                            <div className="text-2xl font-bold text-green-400">
                                {score.correct}
                            </div>
                            <div className="text-xs text-gray-400">Đúng</div>
                        </div>
                        <div className="bg-red-600/20 rounded-xl p-3">
                            <div className="text-2xl font-bold text-red-400">
                                {score.incorrect}
                            </div>
                            <div className="text-xs text-gray-400">Sai</div>
                        </div>
                        <div className="bg-blue-600/20 rounded-xl p-3">
                            <div className="text-2xl font-bold text-blue-400">
                                {Math.round((Date.now() - startTime) / 1000)}s
                            </div>
                            <div className="text-xs text-gray-400">Thời gian</div>
                        </div>
                    </div>

                    {/* Wrong words list */}
                    {wrongWords.length > 0 && (
                        <div className="bg-red-900/20 border border-red-700/30 rounded-xl p-4 mb-6 text-left">
                            <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">error</span>
                                Từ cần ôn lại:
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {wrongWords.map((wordId) => {
                                    const word = words.find((w) => w.id === wordId);
                                    return word ? (
                                        <span
                                            key={wordId}
                                            className="text-sm bg-red-600/20 text-red-300 px-2 py-1 rounded"
                                        >
                                            {word.word}
                                        </span>
                                    ) : null;
                                })}
                            </div>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={restartQuiz}
                            className="w-full py-3 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined">replay</span>
                            Làm lại bài quiz
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

    const currentQuestion = questions[currentIndex];

    return (
        <div className="max-w-xl mx-auto p-4">
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

                {/* Progress */}
                <div className="flex-1 mx-4">
                    <div className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>
                            Câu {currentIndex + 1} / {questions.length}
                        </span>
                        <span>
                            <span className="text-green-400">{score.correct}</span>
                            {" | "}
                            <span className="text-red-400">{score.incorrect}</span>
                        </span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-300"
                            style={{
                                width: `${((currentIndex + 1) / questions.length) * 100}%`,
                            }}
                        />
                    </div>
                </div>

                <div className="w-10" />
            </div>

            {/* Question card */}
            <div className="bg-gradient-to-br from-panel-dark to-card-dark rounded-2xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-text-light text-center mb-6">
                    {currentQuestion.question}
                </h3>

                {/* Options */}
                <div className="space-y-3">
                    {currentQuestion.options.map((option, index) => {
                        let buttonClass =
                            "w-full p-4 rounded-xl text-left transition-all border ";

                        if (!isAnswered) {
                            buttonClass +=
                                selectedAnswer === index
                                    ? "border-primary bg-primary/20 text-text-light"
                                    : "border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-500 hover:bg-gray-700/50";
                        } else {
                            if (index === currentQuestion.correctIndex) {
                                buttonClass +=
                                    "border-green-500 bg-green-600/20 text-green-300";
                            } else if (index === selectedAnswer) {
                                buttonClass += "border-red-500 bg-red-600/20 text-red-300";
                            } else {
                                buttonClass +=
                                    "border-gray-700 bg-gray-800/30 text-gray-500 opacity-50";
                            }
                        }

                        return (
                            <button
                                key={index}
                                onClick={() => handleSelectAnswer(index)}
                                disabled={isAnswered}
                                className={buttonClass}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="w-8 h-8 flex items-center justify-center bg-gray-700/50 rounded-lg text-sm font-medium">
                                        {String.fromCharCode(65 + index)}
                                    </span>
                                    <span className="flex-1">{option}</span>
                                    {isAnswered && index === currentQuestion.correctIndex && (
                                        <span className="material-symbols-outlined text-green-400">
                                            check_circle
                                        </span>
                                    )}
                                    {isAnswered &&
                                        index === selectedAnswer &&
                                        index !== currentQuestion.correctIndex && (
                                            <span className="material-symbols-outlined text-red-400">
                                                cancel
                                            </span>
                                        )}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Explanation after answering */}
                {showExplanation && (
                    <div className="mt-6 p-4 bg-background-dark/50 rounded-xl">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-primary">
                                lightbulb
                            </span>
                            <div>
                                <p className="text-primary font-medium mb-1">
                                    {currentQuestion.word.word}
                                </p>
                                <p className="text-gray-300 text-sm">
                                    {currentQuestion.word.meaning}
                                </p>
                                {currentQuestion.word.example && (
                                    <p className="text-gray-400 text-sm mt-2 italic">
                                        &quot;{currentQuestion.word.example}&quot;
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Next button */}
            {isAnswered && (
                <button
                    onClick={handleNext}
                    className="w-full py-4 bg-primary hover:bg-primary/90 text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                    {currentIndex < questions.length - 1 ? (
                        <>
                            Câu tiếp theo
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </>
                    ) : (
                        <>
                            Xem kết quả
                            <span className="material-symbols-outlined">emoji_events</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
