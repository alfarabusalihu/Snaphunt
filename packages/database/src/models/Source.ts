import { mongoose } from '../client.js';

const { Schema, model, models } = mongoose;

// Embedded analysis result per document per job hash
interface IAnalysisResult {
    jobHash: string;
    score: number;
    suitable: boolean;
    justification: string;
    createdAt: Date;
}

// Embedded document within a source
export interface IDocument {
    _id: string;
    fileName: string;
    location: string;
    checksum: string;
    /** 0 = pending, 1 = indexed, -1 = rejected */
    isIndexed: 0 | 1 | -1;
    qualityScore: number;
    qualityReason?: string;
    textContent?: string;
    analysisResults: IAnalysisResult[];
}

export interface ISource {
    _id: string;
    userId?: string;
    type: 'file' | 'url';
    value: string;
    createdAt: Date;
    documents: IDocument[];
}

const analysisResultSchema = new Schema<IAnalysisResult>({
    jobHash: { type: String, required: true },
    score: { type: Number, required: true },
    suitable: { type: Boolean, required: true },
    justification: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
}, { _id: false });

const documentSchema = new Schema<IDocument>({
    _id: { type: String, required: true },
    fileName: { type: String, required: true },
    location: { type: String, required: true },
    checksum: { type: String, required: true },
    isIndexed: { type: Number, enum: [0, 1, -1], default: 0 },
    qualityScore: { type: Number, default: 1.0 },
    qualityReason: { type: String },
    textContent: { type: String },
    analysisResults: { type: [analysisResultSchema], default: [] },
});

const sourceSchema = new Schema<ISource>({
    _id: { type: String, required: true },
    userId: { type: String, index: true },
    type: { type: String, enum: ['file', 'url'], required: true },
    value: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    documents: { type: [documentSchema], default: [] },
});

// Index for fast checksum lookups across all documents
sourceSchema.index({ 'documents.checksum': 1 });
sourceSchema.index({ 'documents.location': 1 });

export const Source = models.Source ?? model<ISource>('Source', sourceSchema);
