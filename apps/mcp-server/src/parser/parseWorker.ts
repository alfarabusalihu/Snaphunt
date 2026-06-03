import { parentPort, workerData } from "node:worker_threads";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function parsePdfBuffer(buffer: Uint8Array): Promise<string> {
    try {
        const loadingTask = pdfjs.getDocument({
            data: buffer,
            useWorkerFetch: false,
            isEvalSupported: false,
        } as any);

        const pdf = await loadingTask.promise;
        let text = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items
                .map((item: any) => item.str)
                .join(" ");
            
            // Basic data hygiene: Remove common artifacts, extra spaces, and suppression of metadata noise
            const cleanedPage = pageText
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
                .replace(/\s+/g, " ") // Normalize whitespace
                .replace(/(\r\n|\n|\r)/gm, " ") // Remove newlines within paragraphs
                .trim();
                
            text += cleanedPage + "\n";
        }

        return text;
    } catch (error) {
        throw error;
    }
}

// Check if run as a worker
if (parentPort && workerData) {
    const { buffer } = workerData;
    // Buffer passed from main thread might be a SharedArrayBuffer or Buffer, convert to Uint8Array
    const uint8Array = new Uint8Array(buffer);

    parsePdfBuffer(uint8Array)
        .then(text => {
            parentPort?.postMessage({ status: 'success', text });
        })
        .catch(error => {
            parentPort?.postMessage({ status: 'error', error: error.message || String(error) });
        });
}
