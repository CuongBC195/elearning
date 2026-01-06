"use client";

import { useState } from "react";
import { CustomVocabularyWord, PartOfSpeech, DifficultyLevel, Synonym } from "@/types/flashcard";
import { addCustomWord, updateCustomWord } from "@/lib/custom-vocabulary";

interface CustomVocabFormProps {
    editWord?: CustomVocabularyWord | null;
    onClose: () => void;
    onSuccess: () => void;
}

const partOfSpeechOptions: { value: PartOfSpeech; label: string }[] = [
    { value: "noun", label: "Danh từ" },
    { value: "verb", label: "Động từ" },
    { value: "adjective", label: "Tính từ" },
    { value: "adverb", label: "Trạng từ" },
    { value: "phrase", label: "Cụm từ" },
    { value: "other", label: "Khác" },
];

const difficultyOptions: { value: DifficultyLevel; label: string }[] = [
    { value: "beginner", label: "Dễ" },
    { value: "intermediate", label: "Trung bình" },
    { value: "advanced", label: "Khó" },
];

export default function CustomVocabForm({ editWord, onClose, onSuccess }: CustomVocabFormProps) {
    const [formData, setFormData] = useState({
        word: editWord?.word || "",
        meaning: editWord?.meaning || "",
        pronunciation: editWord?.pronunciation || "",
        partOfSpeech: editWord?.partOfSpeech || "noun" as PartOfSpeech,
        example: editWord?.example || "",
        exampleTranslation: editWord?.exampleTranslation || "",
        difficulty: editWord?.difficulty || "intermediate" as DifficultyLevel,
        tips: editWord?.tips || "",
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSaving(true);

        try {
            if (editWord) {
                const result = updateCustomWord(editWord.id, formData);
                if (!result.success) {
                    setError(result.error || "Có lỗi xảy ra");
                    setSaving(false);
                    return;
                }
            } else {
                const result = addCustomWord({
                    ...formData,
                    synonyms: [],
                });
                if (!result.success) {
                    setError(result.error || "Có lỗi xảy ra");
                    setSaving(false);
                    return;
                }
            }
            onSuccess();
        } catch (err) {
            setError("Có lỗi xảy ra");
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-panel-dark rounded-2xl p-6 max-w-lg w-full border border-gray-700 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <h3 className="text-xl font-bold text-text-light mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">
                        {editWord ? "edit" : "add_circle"}
                    </span>
                    {editWord ? "Chỉnh sửa từ vựng" : "Thêm từ vựng mới"}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Word */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">
                            Từ vựng <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.word}
                            onChange={(e) => setFormData({ ...formData, word: e.target.value })}
                            className="w-full px-3 py-2 bg-card-dark border border-gray-700 rounded-lg text-text-light focus:border-primary focus:outline-none"
                            placeholder="sustainability"
                            maxLength={50}
                            required
                        />
                    </div>

                    {/* Meaning */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">
                            Nghĩa tiếng Việt <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.meaning}
                            onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
                            className="w-full px-3 py-2 bg-card-dark border border-gray-700 rounded-lg text-text-light focus:border-primary focus:outline-none"
                            placeholder="tính bền vững"
                            maxLength={200}
                            required
                        />
                    </div>

                    {/* Pronunciation */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Phát âm (IPA)</label>
                        <input
                            type="text"
                            value={formData.pronunciation}
                            onChange={(e) => setFormData({ ...formData, pronunciation: e.target.value })}
                            className="w-full px-3 py-2 bg-card-dark border border-gray-700 rounded-lg text-text-light focus:border-primary focus:outline-none"
                            placeholder="/səˌsteɪnəˈbɪləti/"
                        />
                    </div>

                    {/* Part of Speech & Difficulty */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Loại từ</label>
                            <select
                                value={formData.partOfSpeech}
                                onChange={(e) => setFormData({ ...formData, partOfSpeech: e.target.value as PartOfSpeech })}
                                className="w-full px-3 py-2 bg-card-dark border border-gray-700 rounded-lg text-text-light focus:border-primary focus:outline-none"
                            >
                                {partOfSpeechOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Độ khó</label>
                            <select
                                value={formData.difficulty}
                                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as DifficultyLevel })}
                                className="w-full px-3 py-2 bg-card-dark border border-gray-700 rounded-lg text-text-light focus:border-primary focus:outline-none"
                            >
                                {difficultyOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Example */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Câu ví dụ</label>
                        <textarea
                            value={formData.example}
                            onChange={(e) => setFormData({ ...formData, example: e.target.value })}
                            className="w-full px-3 py-2 bg-card-dark border border-gray-700 rounded-lg text-text-light focus:border-primary focus:outline-none resize-none"
                            placeholder="Sustainability is crucial for future generations."
                            rows={2}
                            maxLength={500}
                        />
                    </div>

                    {/* Example Translation */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Dịch câu ví dụ</label>
                        <textarea
                            value={formData.exampleTranslation}
                            onChange={(e) => setFormData({ ...formData, exampleTranslation: e.target.value })}
                            className="w-full px-3 py-2 bg-card-dark border border-gray-700 rounded-lg text-text-light focus:border-primary focus:outline-none resize-none"
                            placeholder="Tính bền vững rất quan trọng cho các thế hệ tương lai."
                            rows={2}
                        />
                    </div>

                    {/* Tips */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Mẹo ghi nhớ</label>
                        <input
                            type="text"
                            value={formData.tips}
                            onChange={(e) => setFormData({ ...formData, tips: e.target.value })}
                            className="w-full px-3 py-2 bg-card-dark border border-gray-700 rounded-lg text-text-light focus:border-primary focus:outline-none"
                            placeholder="sustain = duy trì + ability = khả năng"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-sm text-red-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-base">error</span>
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-2.5 bg-primary hover:bg-yellow-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-base">save</span>
                            )}
                            {editWord ? "Cập nhật" : "Thêm mới"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
