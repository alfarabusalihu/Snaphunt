import { createWorker } from 'tesseract.js';

export async function performOCR(buffer: Buffer): Promise<string> {
    const worker = await createWorker('eng');
    const ret = await worker.recognize(buffer);
    const text = ret.data.text;
    await worker.terminate();
    return text;
}
