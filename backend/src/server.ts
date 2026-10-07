import express, { Application, NextFunction, Request, Response } from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";
import dns from "dns";
import mongoose from "mongoose";
import connectDB from "./config/db";

// Force IPv4 first for DNS resolution to avoid ENOTFOUND issues in Node.js 17+
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
// Local workaround for flaky ISP DNS; on Vercel use the platform resolver (overriding it breaks the SRV lookup)
if (!process.env.VERCEL) {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}
import routes from "./routes";
import searchRoutes from "./routes/searchRoutes";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { ensureDefaultAdmin } from "./utils/ensureDefaultAdmin";
import { seedHeaderCategories } from "./utils/seedHeaderCategories";
import { initializeSocket } from "./socket/socketService";
import ThemeSettings from "./models/ThemeSettings";
import { expireUnpaidOnlineOrders } from "./services/orderLifecycleService";
import { runSubscriptionJob, setSubscriptionSocket } from "./services/sellerSubscriptionService";

// Load environment variables (.env file reload)
dotenv.config();

const app: Application = express();
const httpServer = createServer(app);

// Comprehensive CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://Unnati.today",
  "https://www.Unnati.today",
  "http://Unnati.today",
  "http://www.Unnati.today",
  "https://api.Unnati.today",

  // Add more origins from environment variable if needed, cleaning up quotes and trailing slashes
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map(url => url.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, ''))
    : [])
].filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Normalize origin (remove trailing slash and lowercase)
    const normalizedOrigin = origin.replace(/\/$/, '').toLowerCase();

    // Special case: allow any Unnati.today domain or localhost
    const isUnnatiToday = normalizedOrigin.endsWith("Unnati.today") ||
                        normalizedOrigin.includes("Unnati.today");

    const isLocalhost = normalizedOrigin.startsWith("http://localhost:") ||
                       normalizedOrigin.startsWith("http://127.0.0.1:") ||
                       normalizedOrigin.startsWith("https://localhost:");

    // Vercel preview / production deployments (e.g. *.vercel.app or vercel-dev)
    let isVercelApp = false;
    try {
      const u = new URL(normalizedOrigin);
      isVercelApp = u.protocol === "https:" && (u.hostname.endsWith(".vercel.app") || u.hostname.includes("vercel"));
    } catch {
      isVercelApp = false;
    }

    if (isUnnatiToday || isLocalhost || isVercelApp) {
      return callback(null, true);
    }

    // Check against the allowed list as a fallback
    const isAllowed = allowedOrigins.some(allowed => {
      const normalizedAllowed = allowed.replace(/\/$/, '').toLowerCase();
      return normalizedOrigin === normalizedAllowed;
    });

    if (isAllowed) {
      return callback(null, true);
    }

    // In web environment, accept incoming origin to prevent blocking production frontends
    console.warn(`[CORS] Request from origin: ${origin} (allowed via wildcard fallback)`);
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Allow-Headers",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
    "Cache-Control",
    "Expires",
    "Pragma",
    "x-api-key",
    "x-module-type",
    "x-display-key" // POS Customer Display screens authenticate with their terminal key
  ],
  exposedHeaders: ["Content-Length", "Content-Type", "X-Total-Count", "Set-Cookie"],
  maxAge: 86400,
  optionsSuccessStatus: 200
};

// Apply CORS middleware first
app.use(cors(corsOptions));

// Explicit handle for OPTIONS requests (redundant but safe)
app.options("*", cors(corsOptions));

// Debug middleware - log all incoming requests
app.use((req: Request, _res: Response, next) => {
  if (process.env.NODE_ENV !== 'production' || req.method !== 'OPTIONS') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.headers.origin || 'N/A'}`);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Vercel runs this file as a serverless function: no listen(), so make sure the DB
// (and one-time setup) is ready before any request is handled.
const isServerless = !!process.env.VERCEL;
let setupPromise: Promise<void> | null = null;
const ensureSetup = () => {
  if (!setupPromise) {
    setupPromise = (async () => {
      await connectDB();
      await ensureDefaultAdmin();
      await seedHeaderCategories();
      await ThemeSettings.getSettings();
    })().catch((err) => {
      setupPromise = null; // retry on the next request instead of failing forever
      throw err;
    });
  }
  return setupPromise;
};
if (isServerless) {
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    ensureSetup()
      // A reused (frozen/thawed) instance can hold a dropped connection: reconnect before handling
      .then(() => (mongoose.connection.readyState === 1 ? undefined : connectDB()))
      .then(() => next(), next);
  });
}

// Initialize Socket.io
const io = initializeSocket(httpServer);
app.set("io", io);
setSubscriptionSocket(io);

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Unnati Stores API Server is running!",
    version: "1.0.0",
    socketIO: "Listening for WebSocket connections",
  });
});


// API Routes
app.use("/api/search", searchRoutes);
app.use("/api/v1", routes);

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Connect DB then ensure default admin exists
  await connectDB();
  await ensureDefaultAdmin();
  await seedHeaderCategories();

  // Ensure default theme settings exist
  await ThemeSettings.getSettings();
  console.log("   \x1b[36mTheme:\x1b[0m ✓ Default theme initialized");

  // Release stock held by online orders whose payment was never completed
  const releaseUnpaidOrders = () =>
    expireUnpaidOnlineOrders()
      .then((count) => count && console.log(`   Released ${count} unpaid online order(s)`))
      .catch((err) => console.error("Failed to release unpaid online orders:", err));
  releaseUnpaidOrders();
  setInterval(releaseUnpaidOrders, 5 * 60 * 1000);

  // Seller subscriptions: reminders before expiry, expiry, hiding products after the grace period
  const runSubscriptions = () =>
    runSubscriptionJob()
      .then((stats) => (stats.reminders || stats.expired || stats.hidden) && console.log("   Subscriptions:", stats))
      .catch((err) => console.error("Subscription job failed:", err));
  runSubscriptions();
  setInterval(runSubscriptions, 60 * 60 * 1000);

  httpServer.timeout = 300000; // 5 minutes
  httpServer.listen(PORT, () => {
    console.log("\n\x1b[32m✓\x1b[0m \x1b[1mUnnati Stores Server Started\x1b[0m");
    console.log(`   \x1b[36mPort:\x1b[0m http://localhost:${PORT}`);
    console.log(
      `   \x1b[36mEnvironment:\x1b[0m ${process.env.NODE_ENV || "development"}`
    );
    console.log(`   \x1b[36mSocket.IO:\x1b[0m ✓ Ready for connections\n`);
  });
}

// On a normal server (local / Render / VPS) start listening and run the background jobs.
// On Vercel the platform calls the exported app per request instead.
if (!isServerless) {
  startServer().catch((err) => {
    console.error("\n\x1b[31m✗ Failed to start server\x1b[0m");
    console.error(err);
    process.exit(1);
  });
}

export default app;

// Trigger dev server restart for storage locations reload - v4.
