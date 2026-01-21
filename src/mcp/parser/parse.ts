import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function parsePdf(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
        const workerPath = join(__dirname, "parseWorker.ts");
        const worker = new Worker(workerPath, {
            workerData: { buffer },
            execArgv: ['--import', 'tsx/esm'] // Enable TSX for worker
        });

        worker.on('message', (message) => {
            if (message.status === 'success') {
                resolve(message.text);
            } else {
                reject(new Error(message.error));
            }
        });

        worker.on('error', (err) => {
            reject(err);
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker stopped with exit code ${code}`));
            }
        });
    });
}
