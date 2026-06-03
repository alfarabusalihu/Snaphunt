export interface ValidationResult {
    isValid: boolean;
    reason?: string;
    score: number;
}

export function validateQuality(text: string): ValidationResult {
    if (!text || text.trim().length < 50) {
        return { isValid: false, reason: "Text content too short or empty", score: 0 };
    }

    // specific check for mojibake / encoding errors
    // distinct characters / length should be reasonable
    const uniqueChars = new Set(text).size;
    if (uniqueChars < 10) {
        return { isValid: false, reason: "Text contains repetitive or monotonous content (likely parsing error)", score: 0.1 };
    }

    if (text.length > 10000) {
        return { isValid: false, reason: "Document too long (exceeds 2-3 page limit), likely not a CV", score: 0 };
    }

    const keywords = ["experience", "education", "skills", "summary", "contact", "email", "phone", "work", "project", "language", "certificate", "references"];
    const lowerText = text.toLowerCase();

    let keywordCount = 0;
    for (const kw of keywords) {
        if (lowerText.includes(kw)) keywordCount++;
    }

    if (keywordCount < 2) {
        return { isValid: false, reason: "Document lacks common resume keywords (Experience, Education, etc.)", score: 0.2 };
    }

    return { isValid: true, score: 1.0 };
}
