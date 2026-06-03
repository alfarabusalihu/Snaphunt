import { mongoose } from '../client.js';

const { Schema, model, models } = mongoose;

export interface IUser {
    _id: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
}

const userSchema = new Schema<IUser>({
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

export const User = models.User ?? model<IUser>('User', userSchema);
