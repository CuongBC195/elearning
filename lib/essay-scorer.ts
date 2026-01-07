// Essay Scorer - Calculate score from feedback history
import { EssaySummary, EssayScore } from "@/types";

// Band mapping for different certificates
const BAND_MAPPINGS: Record<string, Record<string, number>> = {
    // IELTS bands
    "ielts": {
        "5.0": 5.0, "5.5": 5.5, "6.0": 6.0, "6.5": 6.5, "7.0": 7.0, "7.5": 7.5, "8.0": 8.0
    },
    // TOEFL to IELTS equivalent
    "toefl": {
        "60": 6.0, "70": 6.5, "80": 7.0, "90": 7.5, "100": 8.0
    },
    // VSTEP to IELTS equivalent
    "vstep": {
        "B1": 5.5, "B2": 6.5, "C1": 7.5
    }
};

// Parse band string to number
function parseBand(band: string, certificateId: string): number {
    // Try to find in mapping
    const certKey = certificateId.toLowerCase();
    for (const key of Object.keys(BAND_MAPPINGS)) {
        if (certKey.includes(key)) {
            const mapping = BAND_MAPPINGS[key];
            if (mapping[band]) return mapping[band];
        }
    }
    // Fallback: parse as number
    const parsed = parseFloat(band);
    return isNaN(parsed) ? 6.0 : parsed;
}

// Round to nearest 0.5 (for overall - rounds up at .25+)
function roundToHalfUp(num: number): number {
    return Math.round(num * 2) / 2;
}

// Round DOWN to nearest 0.5 (for individual scores - more accurate)
function roundToHalfDown(num: number): number {
    return Math.floor(num * 2) / 2;
}

// Generate feedback message based on score
function generateFeedback(
    grammarErrors: number,
    vocabErrors: number,
    finalScore: number,
    targetScore: number
): string {
    const diff = targetScore - finalScore;

    if (diff <= 0) {
        return "Xuất sắc! Bạn đã đạt hoặc vượt band mục tiêu.";
    } else if (diff <= 0.5) {
        return "Gần đạt mục tiêu! Cần cải thiện một chút.";
    } else if (grammarErrors > vocabErrors) {
        return `Cần cải thiện ngữ pháp (${grammarErrors} lỗi). Chú ý thì, mạo từ, cấu trúc câu.`;
    } else if (vocabErrors > grammarErrors) {
        return `Cần đa dạng từ vựng hơn (${vocabErrors} vấn đề). Sử dụng từ đồng nghĩa cấp cao.`;
    } else {
        return `Cần cải thiện cả ngữ pháp (${grammarErrors}) và từ vựng (${vocabErrors}).`;
    }
}

// Main scoring function
export function calculateScore(
    summary: EssaySummary,
    band: string,
    certificateId: string
): EssayScore {
    const targetBand = parseBand(band, certificateId);

    // Calculate deductions
    const grammarDeduction = Math.min(summary.grammarErrors * 0.1, 1.5);
    const vocabDeduction = Math.min(summary.vocabularyErrors * 0.1, 1.0);
    const totalDeduction = grammarDeduction + vocabDeduction;

    // Calculate final score (minimum 4.0)
    // Overall: rounds UP to match certificate scoring
    const rawScore = targetBand - totalDeduction;
    const overallBand = roundToHalfUp(Math.max(rawScore, 4.0));

    // Individual scores: round DOWN for accurate representation
    const grammarScore = roundToHalfDown(Math.max(targetBand - grammarDeduction, 4.0));
    const vocabScore = roundToHalfDown(Math.max(targetBand - vocabDeduction, 4.0));

    // Generate feedback
    const feedback = generateFeedback(
        summary.grammarErrors,
        summary.vocabularyErrors,
        overallBand,
        targetBand
    );

    return {
        overallBand,
        targetBand,
        grammarScore,
        vocabularyScore: vocabScore,
        grammarErrors: summary.grammarErrors,
        vocabularyErrors: summary.vocabularyErrors,
        feedback,
        scoredAt: Date.now()
    };
}

// Format score for display
export function formatBandScore(score: number): string {
    return score % 1 === 0 ? `${score}.0` : `${score}`;
}

// Get score color based on difference from target
export function getScoreColor(score: number, target: number): string {
    const diff = target - score;
    if (diff <= 0) return "text-green-400";
    if (diff <= 0.5) return "text-yellow-400";
    if (diff <= 1.0) return "text-orange-400";
    return "text-red-400";
}

// Convert IELTS score to other scales (for display)
export function convertScore(ieltsScore: number, targetCert: string): string {
    const cert = targetCert.toLowerCase();

    if (cert.includes("toefl")) {
        // IELTS to TOEFL approximate
        const toeflMap: Record<number, string> = {
            4.0: "32-34", 4.5: "35-45", 5.0: "46-59", 5.5: "60-78",
            6.0: "79-93", 6.5: "94-101", 7.0: "102-109", 7.5: "110-114", 8.0: "115-120"
        };
        return toeflMap[ieltsScore] || `~${Math.round(ieltsScore * 14)}`;
    }

    if (cert.includes("vstep")) {
        // IELTS to VSTEP
        if (ieltsScore >= 7.5) return "C1";
        if (ieltsScore >= 6.0) return "B2";
        if (ieltsScore >= 4.5) return "B1";
        return "A2";
    }

    return formatBandScore(ieltsScore);
}
