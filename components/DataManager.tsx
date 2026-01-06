"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { downloadExportFile, validateImportFile, importData, ImportOptions } from "@/lib/data-manager";
import { ImportValidation } from "@/types/flashcard";

interface DataManagerProps {
    onImportComplete?: () => void;
}

export default function DataManager({ onImportComplete }: DataManagerProps) {
    const [showImportModal, setShowImportModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [validation, setValidation] = useState<ImportValidation | null>(null);
    const [importOptions, setImportOptions] = useState<ImportOptions>({
        importCustomVocabulary: true,
        importProgress: true,
        importEssays: true,
        mode: "merge",
    });
    const [importResult, setImportResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleExport = () => {
        downloadExportFile();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setImportResult(null);

        const result = await validateImportFile(file);
        setValidation(result);
        setImporting(false);
        setShowImportModal(true);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleImport = () => {
        if (!validation?.data) return;

        const result = importData(validation.data, importOptions);

        if (result.success) {
            const parts = [];
            if (result.imported.customVocabulary > 0) {
                parts.push(`${result.imported.customVocabulary} từ vựng`);
            }
            if (result.imported.progress) {
                parts.push("tiến độ học");
            }
            if (result.imported.essays > 0) {
                parts.push(`${result.imported.essays} bài viết`);
            }

            setImportResult({
                success: true,
                message: parts.length > 0
                    ? `Đã import: ${parts.join(", ")}`
                    : "Không có dữ liệu mới để import",
            });

            setTimeout(() => {
                setShowImportModal(false);
                setValidation(null);
                setImportResult(null);
                onImportComplete?.();
            }, 2000);
        } else {
            setImportResult({
                success: false,
                message: "Import thất bại. Vui lòng thử lại.",
            });
        }
    };

    return (
        <>
            {/* Export/Import Buttons */}
            <div className="flex items-center gap-2">
                <button
                    onClick={handleExport}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
                    title="Export toàn bộ dữ liệu"
                >
                    <span className="material-symbols-outlined text-base">download</span>
                    <span className="hidden sm:inline">Export</span>
                </button>

                <label className="flex items-center gap-1.5 px-3 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm cursor-pointer">
                    <span className="material-symbols-outlined text-base">upload</span>
                    <span className="hidden sm:inline">Import</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </label>
            </div>

            {/* Import Modal - using Portal to escape parent overflow */}
            {mounted && showImportModal && createPortal(
                <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
                    <div className="bg-panel-dark rounded-2xl p-6 max-w-md w-full border border-gray-700 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
                        <h3 className="text-xl font-bold text-text-light mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">upload_file</span>
                            Import Data
                        </h3>

                        {importing ? (
                            <div className="flex items-center justify-center py-8">
                                <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
                            </div>
                        ) : validation && !validation.isValid ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-red-400">
                                    <span className="material-symbols-outlined">error</span>
                                    <span>File không hợp lệ</span>
                                </div>
                                <ul className="text-sm text-gray-400 list-disc pl-5">
                                    {validation.errors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                                <button
                                    onClick={() => setShowImportModal(false)}
                                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
                                >
                                    Đóng
                                </button>
                            </div>
                        ) : validation ? (
                            <div className="space-y-4">
                                {/* Summary */}
                                <div className="bg-card-dark rounded-lg p-4 space-y-2">
                                    <p className="text-sm text-gray-400">Tìm thấy trong file:</p>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-background-dark rounded-lg p-2">
                                            <div className="text-lg font-bold text-primary">{validation.summary.customVocabularyCount}</div>
                                            <div className="text-xs text-gray-500">Từ vựng</div>
                                        </div>
                                        <div className="bg-background-dark rounded-lg p-2">
                                            <div className="text-lg font-bold text-green-400">{validation.summary.hasProgress ? "✓" : "-"}</div>
                                            <div className="text-xs text-gray-500">Tiến độ</div>
                                        </div>
                                        <div className="bg-background-dark rounded-lg p-2">
                                            <div className="text-lg font-bold text-blue-400">{validation.summary.essayCount}</div>
                                            <div className="text-xs text-gray-500">Bài viết</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Options */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={importOptions.importCustomVocabulary}
                                            onChange={(e) => setImportOptions({ ...importOptions, importCustomVocabulary: e.target.checked })}
                                            className="rounded bg-gray-700 border-gray-600"
                                        />
                                        Import từ vựng custom
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={importOptions.importProgress}
                                            onChange={(e) => setImportOptions({ ...importOptions, importProgress: e.target.checked })}
                                            className="rounded bg-gray-700 border-gray-600"
                                        />
                                        Import tiến độ học
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={importOptions.importEssays}
                                            onChange={(e) => setImportOptions({ ...importOptions, importEssays: e.target.checked })}
                                            className="rounded bg-gray-700 border-gray-600"
                                        />
                                        Import bài viết
                                    </label>
                                </div>

                                {/* Mode */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setImportOptions({ ...importOptions, mode: "merge" })}
                                        className={`flex-1 py-2 rounded-lg text-sm transition-colors ${importOptions.mode === "merge"
                                            ? "bg-primary text-black font-medium"
                                            : "bg-gray-700 text-gray-300"
                                            }`}
                                    >
                                        Gộp dữ liệu
                                    </button>
                                    <button
                                        onClick={() => setImportOptions({ ...importOptions, mode: "replace" })}
                                        className={`flex-1 py-2 rounded-lg text-sm transition-colors ${importOptions.mode === "replace"
                                            ? "bg-red-600 text-white font-medium"
                                            : "bg-gray-700 text-gray-300"
                                            }`}
                                    >
                                        Thay thế
                                    </button>
                                </div>

                                {importOptions.mode === "replace" && (
                                    <p className="text-xs text-amber-400 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">warning</span>
                                        Dữ liệu hiện tại sẽ bị ghi đè
                                    </p>
                                )}

                                {/* Result */}
                                {importResult && (
                                    <div className={`text-sm p-3 rounded-lg ${importResult.success
                                        ? "bg-green-600/20 text-green-400"
                                        : "bg-red-600/20 text-red-400"
                                        }`}>
                                        {importResult.message}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setShowImportModal(false);
                                            setValidation(null);
                                        }}
                                        className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={handleImport}
                                        disabled={!!importResult}
                                        className="flex-1 py-2 bg-primary hover:bg-yellow-400 text-black font-medium rounded-lg disabled:opacity-50"
                                    >
                                        Import
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
