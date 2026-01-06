import { FlashcardTopic, VocabularyWord } from "@/types/flashcard";
import { TECHNOLOGY_VOCABULARY } from "./technology";
import { HEALTH_VOCABULARY } from "./health";
import { EDUCATION_VOCABULARY } from "./education";
import { BUSINESS_VOCABULARY } from "./business";
import { ENVIRONMENT_VOCABULARY } from "./environment";
import { SOCIETY_VOCABULARY } from "./society";

// All topics configuration
export const FLASHCARD_TOPICS: FlashcardTopic[] = [
    {
        id: "technology",
        name: "Technology",
        nameVi: "Công nghệ",
        description: "Từ vựng về công nghệ, phần mềm, AI, và digital transformation",
        icon: "computer",
        color: "from-blue-500 to-cyan-400",
        wordCount: TECHNOLOGY_VOCABULARY.length,
    },
    {
        id: "health",
        name: "Health & Fitness",
        nameVi: "Sức khỏe",
        description: "Từ vựng về y tế, dinh dưỡng, thể dục, và sức khỏe tinh thần",
        icon: "favorite",
        color: "from-red-500 to-pink-400",
        wordCount: HEALTH_VOCABULARY.length,
    },
    {
        id: "education",
        name: "Education",
        nameVi: "Học tập",
        description: "Từ vựng về giáo dục, trường học, nghiên cứu, và học thuật",
        icon: "school",
        color: "from-purple-500 to-violet-400",
        wordCount: EDUCATION_VOCABULARY.length,
    },
    {
        id: "business",
        name: "Business & Career",
        nameVi: "Kinh doanh",
        description: "Từ vựng về công việc, doanh nghiệp, tài chính, và quản lý",
        icon: "business_center",
        color: "from-amber-500 to-yellow-400",
        wordCount: BUSINESS_VOCABULARY.length,
    },
    {
        id: "environment",
        name: "Environment",
        nameVi: "Môi trường",
        description: "Từ vựng về môi trường, khí hậu, năng lượng xanh, và bảo tồn",
        icon: "eco",
        color: "from-green-500 to-emerald-400",
        wordCount: ENVIRONMENT_VOCABULARY.length,
    },
    {
        id: "society",
        name: "Society & Culture",
        nameVi: "Xã hội",
        description: "Từ vựng về xã hội, văn hóa, chính trị, và các vấn đề xã hội",
        icon: "groups",
        color: "from-indigo-500 to-blue-400",
        wordCount: SOCIETY_VOCABULARY.length,
    },
];

// Combined vocabulary map for easy access
export const VOCABULARY_BY_TOPIC: { [topicId: string]: VocabularyWord[] } = {
    technology: TECHNOLOGY_VOCABULARY,
    health: HEALTH_VOCABULARY,
    education: EDUCATION_VOCABULARY,
    business: BUSINESS_VOCABULARY,
    environment: ENVIRONMENT_VOCABULARY,
    society: SOCIETY_VOCABULARY,
};

// Get all vocabulary words
export function getAllVocabulary(): VocabularyWord[] {
    return [
        ...TECHNOLOGY_VOCABULARY,
        ...HEALTH_VOCABULARY,
        ...EDUCATION_VOCABULARY,
        ...BUSINESS_VOCABULARY,
        ...ENVIRONMENT_VOCABULARY,
        ...SOCIETY_VOCABULARY,
    ];
}

// Get vocabulary by topic ID
export function getVocabularyByTopic(topicId: string): VocabularyWord[] {
    return VOCABULARY_BY_TOPIC[topicId] || [];
}

// Get topic by ID
export function getTopicById(topicId: string): FlashcardTopic | undefined {
    return FLASHCARD_TOPICS.find((topic) => topic.id === topicId);
}

// Get random words from a topic for quiz
export function getRandomWords(
    topicId: string,
    count: number,
    excludeIds: string[] = []
): VocabularyWord[] {
    const words = getVocabularyByTopic(topicId).filter(
        (word) => !excludeIds.includes(word.id)
    );
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// Search vocabulary across all topics
export function searchVocabulary(query: string): VocabularyWord[] {
    const lowerQuery = query.toLowerCase();
    return getAllVocabulary().filter(
        (word) =>
            word.word.toLowerCase().includes(lowerQuery) ||
            word.meaning.toLowerCase().includes(lowerQuery)
    );
}

// Get total word count
export function getTotalWordCount(): number {
    return getAllVocabulary().length;
}

// Export individual vocabularies
export {
    TECHNOLOGY_VOCABULARY,
    HEALTH_VOCABULARY,
    EDUCATION_VOCABULARY,
    BUSINESS_VOCABULARY,
    ENVIRONMENT_VOCABULARY,
    SOCIETY_VOCABULARY,
};
