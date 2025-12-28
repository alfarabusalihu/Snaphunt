import { XMLParser } from "fast-xml-parser";

export async function crawlBucket(url: string): Promise<string[]> {
    console.log(`🌐 Crawling bucket: ${url}`);
    try {
        const res = await fetch(url);
        if (!res.ok) {
            if (res.status === 400 || res.status === 403) {
                console.warn(`🛑 Bucket discovery failed (${res.status}) for ${url}. This usually means directory listing is disabled on this storage provider (e.g. Supabase, S3). Provide a direct file link or a ZIP instead.`);
            }
            throw new Error(`Failed to fetch bucket: ${res.statusText}`);
        }

        const contentType = res.headers.get("content-type") || "";
        const text = await res.text();

        let foundPdfs: string[] = [];

        if (contentType.includes("application/pdf") || url.toLowerCase().endsWith(".pdf")) {
            foundPdfs.push(url);
        }

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
                    foundPdfs.push(fullUrl);
                } catch (e) { }
            }
        }

        foundPdfs = Array.from(new Set(foundPdfs));

        if (foundPdfs.length > 0) {
            console.log(`🔍 Found ${foundPdfs.length} PDFs at/under ${url}`);

            if (foundPdfs.length === 1 && foundPdfs[0] === url && url.toLowerCase().endsWith(".pdf")) {
                const parentUrl = url.substring(0, url.lastIndexOf("/") + 1);
                if (parentUrl !== url) {
                    console.log(`💡 URL is a direct file. Attempting to discover siblings at: ${parentUrl}`);
                    try {
                        const siblings = await crawlBucket(parentUrl);
                        if (siblings.length > 0) return siblings;
                    } catch (e) {
                        console.warn(`Parent crawl failed for ${parentUrl}, sticking with original file.`);
                    }
                }
            }
            return foundPdfs;
        }

        console.log(`⚠️ No PDF links found in content: ${url}`);
        return [];
    } catch (error) {
        console.error("Error crawling bucket:", error);
        if (url.toLowerCase().endsWith(".pdf")) return [url];
        return [];
    }
}
