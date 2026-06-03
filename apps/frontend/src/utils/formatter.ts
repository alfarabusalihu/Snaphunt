/**
 * Formats a raw, messy job description text using client-side heuristic rules.
 * Standardizes headers, identifies and cleans bullet points, and formats paragraph spacing.
 * This runs completely locally in the browser with zero token cost.
 */
export function formatJobDescriptionHeuristically(text: string): string {
    if (!text) return "";

    const lines = text.split(/\r?\n/);
    const formattedLines: string[] = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();

        if (line === "") {
            // Avoid multiple consecutive empty lines
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== "") {
                formattedLines.push("");
            }
            continue;
        }

        // 1. Detect headings
        // A heading is a short line that ends with a colon, is all-caps, or matches common section keywords.
        const isShort = line.length < 80;
        const endsWithColon = line.endsWith(":");
        const isAllCaps = line.length > 3 && line === line.toUpperCase() && !line.startsWith("-") && !line.startsWith("*") && !line.startsWith("•");
        
        const headingKeywords = [
            "requirement", "qualification", "responsibility", "skills", "experience", "role", "duty", 
            "duties", "about us", "who you are", "what you will do", "what you'll do", "benefits", 
            "perk", "offer", "compensation", "about the job", "job details", "overview", "what we look for",
            "what we are looking for", "key info", "description"
        ];
        const containsHeadingKeyword = headingKeywords.some(keyword => 
            line.toLowerCase().includes(keyword)
        );

        const isHeading = isShort && (endsWithColon || isAllCaps || (containsHeadingKeyword && line.length < 50));

        if (isHeading) {
            // If we were in a list, close it
            inList = false;

            // Clean up colon or symbols from heading
            let cleanHeading = line;
            if (cleanHeading.endsWith(":")) {
                cleanHeading = cleanHeading.slice(0, -1).trim();
            }

            // Capitalize first letter
            const capitalized = cleanHeading.charAt(0).toUpperCase() + cleanHeading.slice(1);

            // Add empty line before heading if not already present
            if (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] !== "") {
                formattedLines.push("");
            }

            formattedLines.push(`### ${capitalized}`);
            formattedLines.push(""); // Add space after heading
            continue;
        }

        // 2. Detect lists / bullet points
        // Matches lines starting with bullet characters or numbers
        const bulletRegex = /^[\s]*([•\-*+▪▫\d+.)/])\s*(.*)/;
        const match = line.match(bulletRegex);

        if (match) {
            inList = true;
            let content = match[2].trim();
            if (content) {
                // Capitalize first letter of the content
                content = content.charAt(0).toUpperCase() + content.slice(1);
                formattedLines.push(`- ${content}`);
            }
            continue;
        }

        // 3. Fallback: If it's a short line under a list or heading, make it a bullet item
        const prevLine = formattedLines.length > 0 ? formattedLines[formattedLines.length - 1] : "";
        const isShortItem = line.length < 120 && (inList || prevLine === "" || prevLine.startsWith("###"));

        if (isShortItem) {
            inList = true;
            const content = line.charAt(0).toUpperCase() + line.slice(1);
            formattedLines.push(`- ${content}`);
        } else {
            // Normal paragraph
            inList = false;
            const content = line.charAt(0).toUpperCase() + line.slice(1);
            formattedLines.push(content);
        }
    }

    let result = formattedLines.join("\n");
    // Remove triple newlines
    result = result.replace(/\n{3,}/g, "\n\n");
    return result.trim();
}
