import { mongoose } from '../client.js';

const { Schema, model, models } = mongoose;

export interface IStarredCv {
    _id: string;
    userId: string;
    location: string;
    fileName: string;
    createdAt: Date;
}

const starredCvSchema = new Schema<IStarredCv>({
    _id: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    location: { type: String, required: true },
    fileName: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

starredCvSchema.index({ userId: 1, location: 1 }, { unique: true });

export const StarredCv = models.StarredCv ?? model<IStarredCv>('StarredCv', starredCvSchema);
