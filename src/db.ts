import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = path.resolve('data/snaphunt.db');

if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        source_id TEXT,
        file_name TEXT NOT NULL,
        location TEXT NOT NULL,
        checksum TEXT UNIQUE NOT NULL,
        text_content TEXT,
        is_indexed INTEGER DEFAULT 0,
        FOREIGN KEY(source_id) REFERENCES sources(id)
    );

    CREATE TABLE IF NOT EXISTS analysis_results (
        id TEXT PRIMARY KEY,
        document_id TEXT,
        job_description_hash TEXT NOT NULL,
        suitability_score REAL,
        is_suitable INTEGER DEFAULT 0,
        report TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(document_id) REFERENCES documents(id)
    );
`);

export const registry = {
    createSource: (id: string, type: string, value: string) => {
        db.prepare('INSERT OR REPLACE INTO sources (id, type, value) VALUES (?, ?, ?)').run(id, type, value);
    },

    getDocByChecksum: (checksum: string) => {
        return db.prepare('SELECT * FROM documents WHERE checksum = ?').get(checksum) as any;
    },

    createDocument: (doc: { id: string, source_id: string, file_name: string, location: string, checksum: string, text_content: string }) => {
        db.prepare(`
            INSERT OR REPLACE INTO documents 
            (id, source_id, file_name, location, checksum, text_content) 
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(doc.id, doc.source_id, doc.file_name, doc.location, doc.checksum, doc.text_content);
    },

    markAsIndexed: (id: string) => {
        db.prepare('UPDATE documents SET is_indexed = 1 WHERE id = ?').run(id);
    },

    getAllDocuments: () => {
        return db.prepare('SELECT * FROM documents').all() as any[];
    },

    saveAnalysis: (analysis: { id: string, document_id: string, hash: string, score: number, suitable: boolean, report: string }) => {
        db.prepare(`
            INSERT OR REPLACE INTO analysis_results 
            (id, document_id, job_description_hash, suitability_score, is_suitable, report) 
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(analysis.id, analysis.document_id, analysis.hash, analysis.score, analysis.suitable ? 1 : 0, analysis.report);
    },

    getAnalysisByDocAndHash: (docId: string, hash: string) => {
        return db.prepare('SELECT * FROM analysis_results WHERE document_id = ? AND job_description_hash = ?').get(docId, hash) as any;
    }
};
