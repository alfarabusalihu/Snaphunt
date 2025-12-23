import { XMLParser } from "fast-xml-parser";

export async function crawlBucket(url: string): Promise<string[]> {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch bucket: ${res.statusText}`);

        const contentType = res.headers.get("content-type") || "";
        const text = await res.text();

        if (contentType.includes("xml") || text.trim().startsWith("<?xml")) {
            const parser = new XMLParser();
            const start = text.indexOf("<?xml");
            const cleanText = start >= 0 ? text.substring(start) : text;

            try {
                const data = parser.parse(cleanText);
                const contents = data?.ListBucketResult?.Contents;

                if (Array.isArray(contents)) {
                    return contents
                        .map((item: any) => item.Key)
                        .filter((key: string) => key?.toLowerCase().endsWith(".pdf"))
                        .map((key: string) => new URL(key, url).toString());
                }
                if (contents && contents.Key) {
                    if (contents.Key.toLowerCase().endsWith(".pdf")) {
                        return [new URL(contents.Key, url).toString()];
                    }
                }
            } catch (e) {
                console.warn("Failed to parse XML bucket listing", e);
            }
        }

        const regex = /href=["'](.*?.pdf)["']/gi;
        const matches: string[] = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            if (match[1]) {
                try {
                    const fullUrl = new URL(match[1], url).toString();
                    matches.push(fullUrl);
                } catch (e) { }
            }
        }

        if (matches.length > 0) return matches;

        return [];
    } catch (error) {
        console.error("Error crawling bucket:", error);
        return [];
    }
}
