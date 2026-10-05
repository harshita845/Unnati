import admin from 'firebase-admin';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Where the key can come from, in order:
//  1. FIREBASE_SERVICE_ACCOUNT env var (the JSON itself, or base64 of it) — use this on Vercel/hosting
//  2. config/firebase-service-account.json next to the backend code (not the folder the process started in,
//     which on Vercel is the repo root)
const candidatePaths = [
  path.resolve(__dirname, '../../config/firebase-service-account.json'),
  path.resolve(process.cwd(), 'config/firebase-service-account.json'),
  path.resolve(process.cwd(), 'backend/config/firebase-service-account.json'),
];

const loadServiceAccount = (): any | null => {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (fromEnv) {
    const json = fromEnv.startsWith('{') ? fromEnv : Buffer.from(fromEnv, 'base64').toString('utf8');
    console.log('Firebase Admin: Loading config from FIREBASE_SERVICE_ACCOUNT env var');
    return JSON.parse(json);
  }
  const found = candidatePaths.find((p) => fs.existsSync(p));
  if (!found) return null;
  console.log('Firebase Admin: Loading config from', found);
  return JSON.parse(fs.readFileSync(found, 'utf8'));
};

console.log('Firebase Admin: Initialization sequence started');

// Check if already initialized
try {
  if (!admin.apps.length) {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      // Push notifications are optional: the rest of the app keeps working without them
      console.warn('⚠️ Firebase Admin not configured (set FIREBASE_SERVICE_ACCOUNT) — push notifications are disabled');
      throw new Error('Firebase service account not configured');
    }

    console.log('Firebase Admin: Project ID:', serviceAccount.project_id);
    console.log('Firebase Admin: Client Email:', serviceAccount.client_email);

    // Ensure the private key is properly formatted (common fix for JWT issues)
    if (serviceAccount.private_key) {
      const originalKey = serviceAccount.private_key;
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      if (originalKey !== serviceAccount.private_key) {
        console.log('Firebase Admin: Private key was reformatted (literal \\n replaced)');
      } else {
        console.log('Firebase Admin: Private key format looks correct (already has newlines or no literal \\n found)');
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin Initialized successfully');

    // Async health check
    admin.app().options.credential?.getAccessToken()
      .then(() => console.log('✅ Firebase Auth Check: Credentials are valid and token fetched.'))
      .catch((err: any) => {
        console.error('❌ Firebase Auth Check failed: Invalid Credentials or System Time.');
        console.error('   Error Code:', err.code);
        console.error('   Error Message:', err.message);
      });

  } else {
    console.log('Firebase Admin: Already initialized (apps length:', admin.apps.length, ')');
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error);
}

export const sendPushNotification = async (tokens: string[], payload: any): Promise<any> => {
  try {
    if (!tokens || tokens.length === 0) return;

    // Remove duplicates and invalid tokens
    const uniqueTokens = [...new Set(tokens)].filter(t => t && t.length > 10);

    if (uniqueTokens.length === 0) return;

    // Ensure all data values are strings (FCM requirement)
    const sanitizedData: { [key: string]: string } = {};
    if (payload.data && typeof payload.data === 'object') {
      Object.keys(payload.data).forEach(key => {
        const value = payload.data[key];
        if (value !== undefined && value !== null) {
          sanitizedData[key] = String(value);
        }
      });
    }

    const message: any = {
      notification: {
        title: String(payload.title || ''),
        body: String(payload.body || ''),
      },
      data: sanitizedData,
      tokens: uniqueTokens,
      webpush: {
        notification: {
          title: String(payload.title || ''),
          body: String(payload.body || ''),
          icon: '/notification-icon.png',
          tag: 'Unnati-notification',
          requireInteraction: true,
        },
        fcmOptions: {
          link: payload.data?.url || payload.data?.link || '/'
        }
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          priority: 'high',
          channelId: 'default',
        }
      }
    };

    if (payload.imageUrl) {
      message.notification.imageUrl = String(payload.imageUrl);
    }

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM-SERVICE] 🚀 Successfully dispatched: ${response.successCount} messages`);
    console.log(`[FCM-SERVICE] ⚠️ Failed to dispatch: ${response.failureCount} messages`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`[FCM-SERVICE] ❌ Error for token [${uniqueTokens[idx].substring(0, 10)}...]:`, resp.error);
        }
      });
    }

    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};

export default admin;
