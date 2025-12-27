import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export async function parsePdf(buffer: Buffer): Promise<string> {
    const uint8Array = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;

    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(" ") + "\n";
    }

    console.log("✅ PDF parsed successfully, text length:", text.length);

    return text;
}
