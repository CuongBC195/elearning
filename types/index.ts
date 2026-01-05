export interface EssaySection {
  id: string;
  label: string;
  vn: string;
}

export interface EssayData {
  title: string;
  sections: EssaySection[];
}

export interface AnalysisSuggestion {
  error: string;
  fix: string;
  reason: string;
}

export interface AnalysisResult {
  accuracy: number;
  vocabulary_status: "Advanced" | "Good" | "Needs Review";
  grammar_status: "Good" | "Warning";
  suggestions: AnalysisSuggestion[];
  refined_text: string;
}

export type Translations = { [key: string]: string };

export interface GenerateTopicRequest {
  certificateId: string;
  band: string;
  contentType?: "full" | "outline"; // full = đoạn văn đầy đủ, outline = dàn bài gợi ý
  outlineLanguage?: "vietnamese" | "english"; // Language for the content
}

export interface GeneratedTopic {
  title: string;
  sections: EssaySection[];
  instructions?: string;
}

export interface EssaySummary {
  grammarErrors: number;
  vocabularyErrors: number;
  totalErrors: number;
  commonGrammarMistakes: string[];
  commonVocabularyIssues: string[];
  allSuggestions: AnalysisSuggestion[]; // Lưu toàn bộ suggestions với reason chi tiết
  accuracy: number;
  completedAt: number;
}

export interface SavedEssay {
  id: string;
  title: string;
  certificateId: string;
  band: string;
  target: string;
  createdAt: number;
  updatedAt: number;
  content: string; // User's English translation
  essayData: EssayData; // Original Vietnamese sections
  notes?: string; // User's personal notes
  summary?: EssaySummary; // Summary of errors and completion
  finalFeedback?: AnalysisResult; // Lưu feedback cuối cùng để không cần gửi lại request
  template?: string; // Optional: sample essay content
  contentType?: "full" | "outline"; // Type of content
  outlineLanguage?: "vietnamese" | "english"; // Language of the content

