// Thin bridge so the backend can serve PDF files without importing the full MCP parser stack.
// The MCP server owns the real parser; this just reads the file buffer for serving.
import * as fs from 'fs';

export async function getFileBuffer(filePath: string): Promise<{ buffer: Buffer } | null> {
    try {
        if (!fs.existsSync(filePath)) return null;
        return { buffer: fs.readFileSync(filePath) };
    } catch {
        return null;
    }
}
