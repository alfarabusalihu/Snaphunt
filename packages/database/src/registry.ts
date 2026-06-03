/**
 * registry — async MongoDB replacement for the old SQLite registry.
 * All methods return Promises and use Mongoose models.
 */
import * as crypto from 'node:crypto';
import { User } from './models/User.js';
import { Source } from './models/Source.js';
import { StarredCv } from './models/StarredCv.js';

export const registry = {
    // ── Users ──────────────────────────────────────────────────────────────────
    async createUser(id: string, email: string, passwordHash: string) {
        await User.findByIdAndUpdate(
            id,
            { _id: id, email, passwordHash },
            { upsert: true, new: true }
        );
    },

    async getUserByEmail(email: string) {
        return User.findOne({ email: email.toLowerCase() }).lean();
    },

    async getUserById(id: string) {
        return User.findById(id).lean();
    },

    // ── Sources ────────────────────────────────────────────────────────────────
    async createSource(id: string, userId: string | null | undefined, type: string, value: string) {
        await Source.findByIdAndUpdate(
            id,
            { $setOnInsert: { _id: id, userId: userId ?? null, type, value, documents: [] } },
            { upsert: true }
        );
    },

    async getSources(userId: string) {
        return Source.find({ userId }, { documents: 0 }).sort({ createdAt: -1 }).lean();
    },

    async deleteSource(id: string, userId?: string) {
        const filter = userId ? { _id: id, userId } : { _id: id };
        const source = await Source.findOne(filter).lean();
        if (!source) return;

        // Remove starred CVs whose locations belong to this source
        const locations = source.documents.map((d) => d.location);
        if (locations.length > 0) {
            await StarredCv.deleteMany({ location: { $in: locations } });
        }
        await Source.deleteOne(filter);
    },

    // ── Documents ──────────────────────────────────────────────────────────────
    async getDocByChecksum(checksum: string) {
        const source = await Source.findOne(
            { 'documents.checksum': checksum },
            { 'documents.$': 1, _id: 1 }
        ).lean();
        if (!source || !source.documents[0]) return null;
        return { ...source.documents[0], source_id: source._id };
    },

    async createDocument(doc: {
        id: string;
        source_id: string;
        file_name: string;
        location: string;
        checksum: string;
        text_content?: string;
        quality_score?: number;
        quality_reason?: string;
    }) {
        await Source.updateOne(
            { _id: doc.source_id, 'documents._id': { $ne: doc.id } },
            {
                $push: {
                    documents: {
                        _id: doc.id,
                        fileName: doc.file_name,
                        location: doc.location,
                        checksum: doc.checksum,
                        isIndexed: 0,
                        qualityScore: doc.quality_score ?? 1.0,
                        qualityReason: doc.quality_reason,
                        textContent: doc.text_content ?? '',
                        analysisResults: [],
                    },
                },
            }
        );
        // Update text/quality if doc already exists
        await Source.updateOne(
            { _id: doc.source_id, 'documents._id': doc.id },
            {
                $set: {
                    'documents.$.textContent': doc.text_content ?? '',
                    'documents.$.qualityScore': doc.quality_score ?? 1.0,
                    'documents.$.qualityReason': doc.quality_reason,
                },
            }
        );
    },

    async markAsIndexed(docId: string) {
        await Source.updateOne(
            { 'documents._id': docId },
            { $set: { 'documents.$.isIndexed': 1 } }
        );
    },

    async markAsRejected(docId: string, reason: string) {
        await Source.updateOne(
            { 'documents._id': docId },
            { $set: { 'documents.$.isIndexed': -1, 'documents.$.qualityScore': 0, 'documents.$.qualityReason': reason } }
        );
    },

    async getAllDocuments() {
        const sources = await Source.find({}, { documents: 1 }).lean();
        return sources.flatMap((s) =>
            s.documents.map((d) => ({
                id: d._id,
                source_id: s._id,
                file_name: d.fileName,
                location: d.location,
                checksum: d.checksum,
                is_indexed: d.isIndexed,
                quality_score: d.qualityScore,
                quality_reason: d.qualityReason,
                text_content: d.textContent,
            }))
        );
    },

    async getDocsBySource(sourceId: string) {
        const source = await Source.findById(sourceId, { documents: 1 }).lean();
        if (!source) return [];
        return source.documents.map((d) => ({
            id: d._id,
            source_id: sourceId,
            file_name: d.fileName,
            location: d.location,
            checksum: d.checksum,
            is_indexed: d.isIndexed,
        }));
    },

    async resetIndexStatus() {
        await Source.updateMany(
            {},
            { $set: { 'documents.$[].isIndexed': 0 } }
        );
    },

    // ── Analysis Cache ─────────────────────────────────────────────────────────
    async saveAnalysis(a: {
        id: string;
        document_id: string;
        hash: string;
        score: number;
        suitable: boolean;
        report: string;
    }) {
        await Source.updateOne(
            { 'documents._id': a.document_id },
            {
                $pull: { 'documents.$.analysisResults': { jobHash: a.hash } },
            }
        );
        await Source.updateOne(
            { 'documents._id': a.document_id },
            {
                $push: {
                    'documents.$.analysisResults': {
                        jobHash: a.hash,
                        score: a.score,
                        suitable: a.suitable,
                        justification: a.report,
                        createdAt: new Date(),
                    },
                },
            }
        );
    },

    async getAnalysisByDocAndHash(docId: string, hash: string) {
        const source = await Source.findOne(
            { 'documents._id': docId },
            { 'documents.$': 1 }
        ).lean();
        if (!source?.documents[0]) return null;
        const result = source.documents[0].analysisResults?.find((r) => r.jobHash === hash);
        if (!result) return null;
        return {
            suitability_score: result.score,
            is_suitable: result.suitable ? 1 : 0,
            report: result.justification,
        };
    },

    // ── Starred CVs ────────────────────────────────────────────────────────────
    async starDocument(id: string, userId: string, location: string, fileName: string) {
        await StarredCv.findOneAndUpdate(
            { userId, location },
            { $setOnInsert: { _id: id, userId, location, fileName } },
            { upsert: true }
        );
    },

    async unstarDocument(userId: string, location: string) {
        await StarredCv.deleteOne({ userId, location });
    },

    async getStarredDocuments(userId: string) {
        return StarredCv.find({ userId }).sort({ createdAt: -1 }).lean();
    },

    async getStarredLocations(userId: string): Promise<string[]> {
        const docs = await StarredCv.find({ userId }, { location: 1 }).lean();
        return docs.map((d) => d.location);
    },

    // ── Anon Migration ─────────────────────────────────────────────────────────
    async migrateAnonData(anonId: string, realUserId: string) {
        await Source.updateMany({ userId: anonId }, { $set: { userId: realUserId } });
        // For starred CVs, avoid duplicates
        const anonStarred = await StarredCv.find({ userId: anonId }).lean();
        for (const s of anonStarred) {
            await StarredCv.findOneAndUpdate(
                { userId: realUserId, location: s.location },
                { $setOnInsert: { _id: crypto.randomUUID(), userId: realUserId, location: s.location, fileName: s.fileName } },
                { upsert: true }
            );
        }
        await StarredCv.deleteMany({ userId: anonId });
    },
};
