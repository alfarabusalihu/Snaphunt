import mongoose from 'mongoose';

let connected = false;

export async function connectDB(): Promise<void> {
    if (connected) return;

    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI environment variable is not set');

    await mongoose.connect(uri);
    connected = true;
    console.log('✅ [MongoDB] Connected to snaphunt database');

    mongoose.connection.on('error', (err) => {
        console.error('❌ [MongoDB] Connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
        connected = false;
        console.warn('⚠️ [MongoDB] Disconnected');
    });
}

export { mongoose };
