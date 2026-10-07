import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async (): Promise<void> => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Serverless (Vercel) reuses a warm instance between requests: reuse the open connection
    if (mongoose.connection.readyState === 1) return;
    // Another request on this instance is already connecting: wait for it instead of connecting twice
    if (mongoose.connection.readyState === 2) {
      await mongoose.connection.asPromise();
      return;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Fail fast on serverless so a bad connection returns an error before the function times out
      ...(process.env.VERCEL && { serverSelectionTimeoutMS: 8000 }),
    });

    console.log('\n\x1b[32m✓\x1b[0m \x1b[1mMongoDB Connected Successfully\x1b[0m');
    console.log(`   \x1b[36mHost:\x1b[0m ${conn.connection.host}`);
    console.log(`   \x1b[36mDatabase:\x1b[0m ${conn.connection.name}\n`);
  } catch (error) {
    console.error('\n\x1b[31m✗\x1b[0m \x1b[1mMongoDB Connection Error\x1b[0m');
    if (error instanceof Error) {
      console.error(`   \x1b[31m${error.message}\x1b[0m\n`);
    } else {
      console.error(`   \x1b[31m${String(error)}\x1b[0m\n`);
    }
    // On Vercel a request fails instead; exiting would crash the function for every request
    if (process.env.VERCEL) throw error;
    process.exit(1);
  }
};



export default connectDB;




