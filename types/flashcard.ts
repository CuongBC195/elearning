// Flashcard Types

export type PartOfSpeech = "noun" | "verb" | "adjective" | "adverb" | "phrase" | "other";
export type DifficultyLevel = "beginner" | "intermediate" | "advanced";
export type SynonymLevel = "basic" | "intermediate" | "advanced" | "academic";
export type WordStatus = "new" | "learning" | "mastered";

// Synonym với level để gợi ý từ cấp cao hơn
export interface Synonym {
    word: string;
    level: SynonymLevel;
    meaning?: string; // Nghĩa tiếng Việt (optional)
}

// Cấu trúc một từ vựng
export interface VocabularyWord {
    id: string;
    word: string;
    meaning: string; // Nghĩa tiếng Việt
    pronunciation: string; // IPA
    partOfSpeech: PartOfSpeech;
    example: string; // Câu ví dụ tiếng Anh
    exampleTranslation: string; // Dịch câu ví dụ
    synonyms: Synonym[];
    antonyms?: string[]; // Từ trái nghĩa (optional)
    topic: string;
    difficulty: DifficultyLevel;
    tips?: string; // Mẹo ghi nhớ (optional)
}

// Chủ đề từ vựng
export interface FlashcardTopic {
    id: string;
    name: string;
    nameVi: string; // Tên tiếng Việt
    description: string;
    icon: string; // Material Symbol icon name
    color: string; // Tailwind color class
    wordCount: number;
}

// Progress cho mỗi từ
export interface WordProgress {
    wordId: string;
    status: WordStatus;
    correctCount: number;
    incorrectCount: number;
    lastStudied: number; // Timestamp
    nextReview: number; // Timestamp for spaced repetition
}

// Progress tổng cho một topic
export interface TopicProgress {
    topicId: string;
    totalWords: number;
    newWords: number;
    learningWords: number;
    masteredWords: number;
    lastStudied: number;
    totalStudyTime: number; // in seconds
    quizHighScore: number;
}

// Quiz question
export interface QuizQuestion {
    id: string;
    word: VocabularyWord;
    questionType: "word-to-meaning" | "meaning-to-word" | "fill-blank" | "synonym";
    question: string;
    options: string[];
    correctAnswer: string;
    correctIndex: number;
}

// Quiz result
export interface QuizResult {
    topicId: string;
    totalQuestions: number;
    correctAnswers: number;
    incorrectAnswers: number;
    score: number; // Percentage
    completedAt: number;
    timeSpent: number; // in seconds
    wrongWords: string[]; // IDs of words answered incorrectly
}

// Flashcard storage structure
export interface FlashcardStorage {
    wordProgress: { [wordId: string]: WordProgress };
    topicProgress: { [topicId: string]: TopicProgress };
    quizHistory: QuizResult[];
    settings: FlashcardSettings;
    lastUpdated: number;
}

// User settings for flashcard
export interface FlashcardSettings {
    cardsPerSession: number; // Default: 20
    showPronunciation: boolean;
    showExample: boolean;
    autoPlayAudio: boolean;
    quizQuestionsCount: number; // Default: 10
    shuffleCards: boolean;
}

// Default settings
export const DEFAULT_FLASHCARD_SETTINGS: FlashcardSettings = {
    cardsPerSession: 20,
    showPronunciation: true,
    showExample: true,
    autoPlayAudio: false,
    quizQuestionsCount: 10,
    shuffleCards: true,
};

// localStorage key
export const FLASHCARD_STORAGE_KEY = "flashcard_progress";
