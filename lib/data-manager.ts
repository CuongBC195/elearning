// Data Manager - Export/Import functionality
import {
    ExportData,
    ImportValidation,
    CustomVocabularyWord,
    FlashcardStorage,
    FLASHCARD_STORAGE_KEY,
    CUSTOM_VOCABULARY_KEY,
    ESSAYS_STORAGE_KEY,
} from "@/types/flashcard";

const CURRENT_VERSION = "1.0";
const MAX_IMPORT_SIZE = 1024 * 1024; // 1MB

// ============================================================================
// EXPORT
// ============================================================================

export function exportAllData(): ExportData {
    let customVocabulary: CustomVocabularyWord[] = [];
    let flashcardProgress: FlashcardStorage | null = null;
    let essays: any[] = [];

    try {
        // Get custom vocabulary
        const customStored = localStorage.getItem(CUSTOM_VOCABULARY_KEY);
        if (customStored) {
            customVocabulary = JSON.parse(customStored);
        }

        // Get flashcard progress
        const progressStored = localStorage.getItem(FLASHCARD_STORAGE_KEY);
        if (progressStored) {
            flashcardProgress = JSON.parse(progressStored);
        }

        // Get essays
        const essaysStored = localStorage.getItem(ESSAYS_STORAGE_KEY);
        if (essaysStored) {
            essays = JSON.parse(essaysStored);
        }
    } catch (error) {
        console.error("Error reading localStorage:", error);
    }

    return {
        version: CURRENT_VERSION,
        exportedAt: new Date().toISOString(),
        customVocabulary,
        flashcardProgress,
        essays,
    };
}

export function downloadExportFile(): void {
    const data = exportAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `elearning-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================================
// IMPORT VALIDATION
// ============================================================================

function sanitizeString(str: unknown): string {
    if (typeof str !== "string") return "";
    return str
        .replace(/<[^>]*>/g, "") // Remove HTML tags
        .replace(/[<>]/g, "") // Remove stray angle brackets
        .trim()
        .slice(0, 1000); // Limit length
}

export async function validateImportFile(file: File): Promise<ImportValidation> {
    const errors: string[] = [];

    // Check file size
    if (file.size > MAX_IMPORT_SIZE) {
        return {
            isValid: false,
            errors: ["File quá lớn. Tối đa 1MB."],
            data: null,
            summary: { customVocabularyCount: 0, hasProgress: false, essayCount: 0 },
        };
    }

    // Check file type
    if (!file.name.endsWith(".json")) {
        return {
            isValid: false,
            errors: ["Chỉ hỗ trợ file JSON."],
            data: null,
            summary: { customVocabularyCount: 0, hasProgress: false, essayCount: 0 },
        };
    }

    // Read and parse file
    let data: ExportData;
    try {
        const text = await file.text();
        data = JSON.parse(text);
    } catch {
        return {
            isValid: false,
            errors: ["File JSON không hợp lệ."],
            data: null,
            summary: { customVocabularyCount: 0, hasProgress: false, essayCount: 0 },
        };
    }

    // Validate structure
    if (typeof data !== "object" || data === null) {
        errors.push("Cấu trúc data không hợp lệ.");
    }

    if (!data.version) {
        errors.push("Thiếu version.");
    }

    // Validate custom vocabulary
    let validCustomVocab: CustomVocabularyWord[] = [];
    if (Array.isArray(data.customVocabulary)) {
        for (const word of data.customVocabulary) {
            if (typeof word.word === "string" && typeof word.meaning === "string") {
                validCustomVocab.push({
                    ...word,
                    word: sanitizeString(word.word).slice(0, 50),
                    meaning: sanitizeString(word.meaning).slice(0, 200),
                    example: word.example ? sanitizeString(word.example).slice(0, 500) : undefined,
                });
            }
        }
        if (validCustomVocab.length > 200) {
            validCustomVocab = validCustomVocab.slice(0, 200);
            errors.push("Chỉ import tối đa 200 từ vựng custom.");
        }
    }

    // Validate essays
    let validEssays: any[] = [];
    if (Array.isArray(data.essays)) {
        validEssays = data.essays.slice(0, 50); // Max 50 essays
    }

    const cleanedData: ExportData = {
        version: data.version || CURRENT_VERSION,
        exportedAt: data.exportedAt || new Date().toISOString(),
        customVocabulary: validCustomVocab,
        flashcardProgress: data.flashcardProgress || null,
        essays: validEssays,
    };

    return {
        isValid: errors.length === 0,
        errors,
        data: cleanedData,
        summary: {
            customVocabularyCount: validCustomVocab.length,
            hasProgress: !!data.flashcardProgress,
            essayCount: validEssays.length,
        },
    };
}

// ============================================================================
// IMPORT
// ============================================================================

export type ImportMode = "replace" | "merge";

export interface ImportOptions {
    importCustomVocabulary: boolean;
    importProgress: boolean;
    importEssays: boolean;
    mode: ImportMode;
}

export function importData(data: ExportData, options: ImportOptions): {
    success: boolean;
    imported: {
        customVocabulary: number;
        progress: boolean;
        essays: number;
    };
} {
    const result = { customVocabulary: 0, progress: false, essays: 0 };

    try {
        // Import custom vocabulary
        if (options.importCustomVocabulary && data.customVocabulary.length > 0) {
            if (options.mode === "replace") {
                localStorage.setItem(CUSTOM_VOCABULARY_KEY, JSON.stringify(data.customVocabulary));
                result.customVocabulary = data.customVocabulary.length;
            } else {
                // Merge
                const existing = JSON.parse(localStorage.getItem(CUSTOM_VOCABULARY_KEY) || "[]");
                const existingIds = new Set(existing.map((w: any) => w.word.toLowerCase()));
                const newWords = data.customVocabulary.filter(
                    (w) => !existingIds.has(w.word.toLowerCase())
                );
                const merged = [...existing, ...newWords].slice(0, 200);
                localStorage.setItem(CUSTOM_VOCABULARY_KEY, JSON.stringify(merged));
                result.customVocabulary = newWords.length;
            }
        }

        // Import progress
        if (options.importProgress && data.flashcardProgress) {
            if (options.mode === "replace") {
                localStorage.setItem(FLASHCARD_STORAGE_KEY, JSON.stringify(data.flashcardProgress));
                result.progress = true;
            } else {
                // Merge progress
                const existing = JSON.parse(localStorage.getItem(FLASHCARD_STORAGE_KEY) || "{}");
                const merged = {
                    ...existing,
                    wordProgress: { ...existing.wordProgress, ...data.flashcardProgress.wordProgress },
                    topicProgress: { ...existing.topicProgress, ...data.flashcardProgress.topicProgress },
                    quizHistory: [
                        ...(existing.quizHistory || []),
                        ...(data.flashcardProgress.quizHistory || []),
                    ].slice(-50),
                };
                localStorage.setItem(FLASHCARD_STORAGE_KEY, JSON.stringify(merged));
                result.progress = true;
            }
        }

        // Import essays
        if (options.importEssays && data.essays.length > 0) {
            if (options.mode === "replace") {
                localStorage.setItem(ESSAYS_STORAGE_KEY, JSON.stringify(data.essays));
                result.essays = data.essays.length;
            } else {
                // Merge
                const existing = JSON.parse(localStorage.getItem(ESSAYS_STORAGE_KEY) || "[]");
                const existingIds = new Set(existing.map((e: any) => e.id));
                const newEssays = data.essays.filter((e) => !existingIds.has(e.id));
                const merged = [...existing, ...newEssays].slice(0, 50);
                localStorage.setItem(ESSAYS_STORAGE_KEY, JSON.stringify(merged));
                result.essays = newEssays.length;
            }
        }

        return { success: true, imported: result };
    } catch (error) {
        console.error("Import error:", error);
        return { success: false, imported: result };
    }
}
