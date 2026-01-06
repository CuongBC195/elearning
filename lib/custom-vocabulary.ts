// Custom Vocabulary CRUD Operations
import {
    CustomVocabularyWord,
    CUSTOM_VOCABULARY_KEY,
    PartOfSpeech,
    DifficultyLevel,
    Synonym
} from "@/types/flashcard";

// ============================================================================
// VALIDATION & SANITIZATION
// ============================================================================

const MAX_WORD_LENGTH = 50;
const MAX_MEANING_LENGTH = 200;
const MAX_EXAMPLE_LENGTH = 500;
const MAX_CUSTOM_WORDS = 200;

// Sanitize string - remove HTML tags and trim
function sanitize(str: string): string {
    if (!str) return "";
    return str
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/[<>]/g, "") // Remove stray angle brackets
        .trim();
}

// Validate a custom word
export function validateCustomWord(word: Partial<CustomVocabularyWord>): {
    isValid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!word.word || word.word.trim().length === 0) {
        errors.push("Từ vựng không được để trống");
    } else if (word.word.length > MAX_WORD_LENGTH) {
        errors.push(`Từ vựng không quá ${MAX_WORD_LENGTH} ký tự`);
    }

    if (!word.meaning || word.meaning.trim().length === 0) {
        errors.push("Nghĩa không được để trống");
    } else if (word.meaning.length > MAX_MEANING_LENGTH) {
        errors.push(`Nghĩa không quá ${MAX_MEANING_LENGTH} ký tự`);
    }

    if (word.example && word.example.length > MAX_EXAMPLE_LENGTH) {
        errors.push(`Ví dụ không quá ${MAX_EXAMPLE_LENGTH} ký tự`);
    }

    return { isValid: errors.length === 0, errors };
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

// Get all custom vocabulary
export function getCustomVocabulary(): CustomVocabularyWord[] {
    try {
        if (typeof window === "undefined") return [];
        const stored = localStorage.getItem(CUSTOM_VOCABULARY_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

// Save all custom vocabulary
function saveCustomVocabulary(words: CustomVocabularyWord[]): void {
    try {
        localStorage.setItem(CUSTOM_VOCABULARY_KEY, JSON.stringify(words));
    } catch (error) {
        console.error("Failed to save custom vocabulary:", error);
    }
}

// Generate unique ID
function generateId(): string {
    return `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Add new custom word
export function addCustomWord(word: Omit<CustomVocabularyWord, "id" | "createdAt" | "updatedAt">): {
    success: boolean;
    error?: string;
    word?: CustomVocabularyWord;
} {
    const words = getCustomVocabulary();

    // Check limit
    if (words.length >= MAX_CUSTOM_WORDS) {
        return { success: false, error: `Đã đạt giới hạn ${MAX_CUSTOM_WORDS} từ vựng` };
    }

    // Check duplicate
    const duplicate = words.find(
        (w) => w.word.toLowerCase() === word.word.toLowerCase()
    );
    if (duplicate) {
        return { success: false, error: "Từ này đã tồn tại" };
    }

    // Validate
    const validation = validateCustomWord(word);
    if (!validation.isValid) {
        return { success: false, error: validation.errors[0] };
    }

    // Create new word
    const now = Date.now();
    const newWord: CustomVocabularyWord = {
        id: generateId(),
        word: sanitize(word.word),
        meaning: sanitize(word.meaning),
        pronunciation: word.pronunciation ? sanitize(word.pronunciation) : undefined,
        partOfSpeech: word.partOfSpeech || "other",
        example: word.example ? sanitize(word.example) : undefined,
        exampleTranslation: word.exampleTranslation ? sanitize(word.exampleTranslation) : undefined,
        synonyms: word.synonyms?.slice(0, 5), // Max 5 synonyms
        difficulty: word.difficulty || "intermediate",
        tips: word.tips ? sanitize(word.tips) : undefined,
        createdAt: now,
        updatedAt: now,
    };

    words.push(newWord);
    saveCustomVocabulary(words);

    return { success: true, word: newWord };
}

// Update custom word
export function updateCustomWord(
    id: string,
    updates: Partial<CustomVocabularyWord>
): { success: boolean; error?: string } {
    const words = getCustomVocabulary();
    const index = words.findIndex((w) => w.id === id);

    if (index === -1) {
        return { success: false, error: "Không tìm thấy từ vựng" };
    }

    // Validate updates
    const validation = validateCustomWord({ ...words[index], ...updates });
    if (!validation.isValid) {
        return { success: false, error: validation.errors[0] };
    }

    // Update
    words[index] = {
        ...words[index],
        word: updates.word ? sanitize(updates.word) : words[index].word,
        meaning: updates.meaning ? sanitize(updates.meaning) : words[index].meaning,
        pronunciation: updates.pronunciation !== undefined ? sanitize(updates.pronunciation) : words[index].pronunciation,
        partOfSpeech: updates.partOfSpeech || words[index].partOfSpeech,
        example: updates.example !== undefined ? sanitize(updates.example) : words[index].example,
        exampleTranslation: updates.exampleTranslation !== undefined ? sanitize(updates.exampleTranslation) : words[index].exampleTranslation,
        synonyms: updates.synonyms?.slice(0, 5) || words[index].synonyms,
        difficulty: updates.difficulty || words[index].difficulty,
        tips: updates.tips !== undefined ? sanitize(updates.tips) : words[index].tips,
        updatedAt: Date.now(),
    };

    saveCustomVocabulary(words);
    return { success: true };
}

// Delete custom word
export function deleteCustomWord(id: string): { success: boolean; error?: string } {
    const words = getCustomVocabulary();
    const index = words.findIndex((w) => w.id === id);

    if (index === -1) {
        return { success: false, error: "Không tìm thấy từ vựng" };
    }

    words.splice(index, 1);
    saveCustomVocabulary(words);
    return { success: true };
}

// Get custom word by ID
export function getCustomWordById(id: string): CustomVocabularyWord | null {
    const words = getCustomVocabulary();
    return words.find((w) => w.id === id) || null;
}

// Convert CustomVocabularyWord to VocabularyWord format for compatibility
export function convertToVocabularyWord(custom: CustomVocabularyWord) {
    return {
        id: custom.id,
        word: custom.word,
        meaning: custom.meaning,
        pronunciation: custom.pronunciation || "/.../ ",
        partOfSpeech: custom.partOfSpeech,
        example: custom.example || "",
        exampleTranslation: custom.exampleTranslation || "",
        synonyms: custom.synonyms || [],
        topic: "custom",
        difficulty: custom.difficulty,
        tips: custom.tips,
    };
}
