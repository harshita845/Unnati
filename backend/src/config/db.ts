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
      ...(process.env.VERCEL && {
        // Fail fast on serverless so a bad connection returns an error before the function times out
        serverSelectionTimeoutMS: 8000,
        // Every Vercel instance gets its own pool. The default (up to 100 each, kept open) lets a few
        // instances plus a redeploy use up the Atlas connection limit (500 on the free tier), after
        // which Atlas refuses new connections ("SSL alert number 80") and every request fails.
        maxPoolSize: 5,
        minPoolSize: 0,
        maxIdleTimeMS: 10000,
        // Don't re-send createIndex for every model on each cold start (it delayed the first
        // request by ~5s). Indexes already exist in Atlas; local dev (autoIndex on) maintains them.
        autoIndex: false,
      }),
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




