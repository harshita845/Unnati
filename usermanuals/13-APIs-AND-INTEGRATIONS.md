# APIs, Services & Third-Party Integrations
## Complete Breakdown of Every External Service & API Used in the Project

> This document covers **every external API, service, platform, and integration** used in the Unnati project — what it does, where it is used, what keys/credentials are needed, and how to manage it.

---

## 📋 Table of Contents

1. [Infrastructure & Hosting](#1-infrastructure--hosting)
2. [Database — MongoDB Atlas](#2-database--mongodb-atlas)
3. [Payment Gateway — Razorpay](#3-payment-gateway--razorpay)
4. [Payment Gateway — PhonePe (Configured, Alternate)](#4-payment-gateway--phonepe)
5. [Payment Gateway — Cashfree (Configured, Alternate)](#5-payment-gateway--cashfree)
6. [Image & File Storage — Cloudinary](#6-image--file-storage--cloudinary)
7. [Push Notifications — Firebase (FCM)](#7-push-notifications--firebase-fcm)
8. [Maps & Location — Google Maps](#8-maps--location--google-maps)
9. [Maps Fallback — Leaflet.js + OpenStreetMap](#9-maps-fallback--leafletjs--openstreetmap)
10. [SMS & OTP — SMS India Hub](#10-sms--otp--sms-india-hub)
11. [SMS & OTP — 2Factor (Alternate)](#11-sms--otp--2factor-alternate)
12. [Shipping — Shiprocket](#12-shipping--shiprocket)
13. [AI Search — Xenova Transformers](#13-ai-search--xenova-transformers)
14. [Google Custom Search API (Product Image Search)](#14-google-custom-search-api)
15. [Google Gemini AI API](#15-google-gemini-ai-api)
16. [Real-Time Communication — Socket.IO](#16-real-time-communication--socketio)
17. [Authentication — JWT (JSON Web Tokens)](#17-authentication--jwt)
18. [PDF Generation — jsPDF](#18-pdf-generation--jspdf)
19. [Excel Export — xlsx Library](#19-excel-export--xlsx-library)
20. [Rate Limiting — express-rate-limit](#20-rate-limiting--express-rate-limit)
21. [Frontend Deployment — Vercel](#21-frontend-deployment--vercel)
22. [Backend Server — Node.js / Express](#22-backend-server--nodejs--express)
23. [Email (SMTP Mail)](#23-email-smtp-mail)
24. [Environment Variables Master Reference](#24-environment-variables-master-reference)
25. [Where Each API Key is Used — Summary Table](#25-where-each-api-key-is-used)

---

## 1. Infrastructure & Hosting

### Frontend — Vercel

| Detail | Value |
|--------|-------|
| **Platform** | Vercel (vercel.com) |
| **What It Hosts** | The customer-facing website, seller portal, admin portal, delivery app |
| **Production URL** | `https://Unnati.today` / `https://www.Unnati.today` |
| **Build Command** | `npm run build:vercel` |
| **Output Directory** | `dist/` |
| **Framework** | React + Vite (TypeScript) |

**What Vercel Does:**
- Serves the entire frontend application globally via CDN.
- Handles routing (SPA rewrites — all URLs → `index.html`).
- Automatically deploys when code is pushed to the repository.
- Adds security headers (XSS protection, MIME type sniffing prevention, etc.).

**Configuration File:** [`vercel.json`](file:///c:/Users/HP/Desktop/Unnati/frontend/vercel.json)

---

### Backend — Custom VPS / Server

| Detail | Value |
|--------|-------|
| **Runtime** | Node.js with Express.js |
| **Language** | TypeScript (compiled to JavaScript) |
| **Port** | `5001` (development) |
| **Production API URL** | `https://api.Unnati.today` |
| **Start Command** | `npm start` (runs `node dist/server.js`) |
| **Dev Command** | `npm run dev` (uses `tsx watch`) |

**What the Backend Does:**
- Handles all API requests from the frontend.
- Connects to MongoDB, Cloudinary, Firebase, Razorpay, etc.
- Manages authentication, orders, products, notifications.
- Runs the Socket.IO WebSocket server for real-time communication.

---

## 2. Database — MongoDB Atlas

| Detail | Value |
|--------|-------|
| **Service** | MongoDB Atlas (cloud.mongodb.com) |
| **Type** | Cloud-hosted NoSQL database |
| **Cluster** | `Cluster1.moyfuna.mongodb.net` |
| **Database Name** | `Unnati-ecom` |
| **Connection User** | `allokfarms_db_user` |

### What MongoDB Stores:

Every piece of data in the platform is stored in MongoDB:

| Collection | What It Stores |
|-----------|---------------|
| `customers` | All registered customer accounts |
| `sellers` | All seller accounts and store details |
| `deliveries` | Delivery agent accounts |
| `admins` | Admin user accounts |
| `products` | All product listings with variants |
| `orders` | All orders (online + POS) |
| `orderitems` | Individual line items of each order |
| `carts` | Customer shopping carts |
| `cartitems` | Items inside each cart |
| `categories` | Product categories |
| `subcategories` | Product subcategories |
| `headercategories` | Navigation header categories |
| `brands` | Product brands |
| `coupons` | Discount coupon codes |
| `banners` | Promotional banners |
| `flashdeals` | Flash deal configurations |
| `freegiftrules` | Free gift milestone rules |
| `notifications` | Push notification records |
| `walletransactions` | Seller wallet credits/debits |
| `withdrawrequests` | Seller withdrawal requests |
| `reviews` | Product customer reviews |
| `payments` | Payment transaction records |
| `otps` | OTP verification codes (temporary) |
| `appsettings` | Platform-wide settings |
| `themesettings` | Theme/color configurations |
| `videosfinds` | Product video links |
| `faqs` | FAQ entries |
| `homesections` | Home page section configuration |
| `promostrips` | Scrolling promo messages |
| `deliverytracking` | Live delivery location tracking |
| `deliveryassignments` | Which delivery agent handles which order |
| `searchanalytics` | What customers searched for |
| `inventorylosses` | Damaged/expired stock records |
| `stockledgers` | Stock in/out history |

### Environment Variable:
```
MONGODB_URI=mongodb+srv://<user>:<password>@cluster1.moyfuna.mongodb.net/Unnati-ecom
```

### Where to Manage:
- **MongoDB Atlas Dashboard:** [cloud.mongodb.com](https://cloud.mongodb.com)
- Create database users, monitor performance, set up backups.

---

## 3. Payment Gateway — Razorpay

| Detail | Value |
|--------|-------|
| **Service** | Razorpay (razorpay.com) |
| **Mode** | Currently **Test Mode** (`rzp_test_...`) |
| **API Endpoint** | `https://api.razorpay.com/v1/` |
| **Key ID** | `rzp_test_S3IcSS1NbymL6D` |
| **Frontend Library** | Razorpay Checkout JS (loaded from Razorpay CDN) |

### What Razorpay Does:

Razorpay is the **primary online payment gateway**. It processes all online payments made by customers.

| Feature | How It's Used |
|---------|--------------|
| **Online Order Payment** | Customer pays for orders via UPI, card, net banking |
| **POS Online Payment** | Seller uses Razorpay for in-store card/UPI payments |
| **Refunds** | Cancelled orders → refund initiated via Razorpay API |
| **Payment Verification** | Backend verifies payment signature after checkout |
| **Payment Sub-methods** | UPI, Credit Card, Debit Card, Net Banking, Wallets, EMI |

### Payment Flow (Step by Step):
```
Customer clicks "Pay Now"
      ↓
Backend calls Razorpay API: POST /v1/orders (creates Razorpay order)
      ↓
Frontend opens Razorpay Checkout popup
      ↓
Customer completes payment in popup
      ↓
Razorpay returns: payment_id, order_id, signature
      ↓
Backend verifies the signature (HMAC-SHA256)
      ↓
Order is confirmed as Paid
```

### Environment Variables:
```env
RAZORPAY_KEY_ID=rzp_test_S3IcSS1NbymL6D
RAZORPAY_KEY_SECRET=l3V33lPquN4UDaN5S1zuMDBq
```

> ⚠️ **IMPORTANT:** Current keys are **TEST keys** — switch to **LIVE keys** before going live with real customers. Live keys look like `rzp_live_...`

### Where to Manage:
- **Razorpay Dashboard:** [dashboard.razorpay.com](https://dashboard.razorpay.com)
- View all transactions, refunds, settlements.
- Generate live API keys under Settings → API Keys.

---

## 4. Payment Gateway — PhonePe

| Detail | Value |
|--------|-------|
| **Service** | PhonePe Payment Gateway |
| **Status** | ⚠️ **Integrated in code but NOT CURRENTLY ACTIVE** (credentials not in `.env`) |
| **UAT (Test) API** | `https://api-preprod.phonepe.com/apis/pg-sandbox` |
| **Production API** | `https://api.phonepe.com/apis/hermes` |

### What PhonePe Does (if enabled):

PhonePe is an **alternate payment gateway** — integrated as a backup to Razorpay. It supports UPI, cards, and wallet payments.

### To Activate PhonePe, Add to `.env`:
```env
PHONEPE_MERCHANT_ID=your_merchant_id
PHONEPE_SALT_KEY=your_salt_key
PHONEPE_SALT_INDEX=1
PHONEPE_ENV=UAT  # or PRODUCTION
```

### Where to Manage:
- **PhonePe Business Dashboard:** [business.phonepe.com](https://business.phonepe.com)

---

## 5. Payment Gateway — Cashfree

| Detail | Value |
|--------|-------|
| **Service** | Cashfree Payments (cashfree.com) |
| **Status** | ⚠️ **Integrated in code but NOT CURRENTLY ACTIVE** (credentials not in `.env`) |
| **Sandbox (Test) API** | `https://sandbox.cashfree.com/pg` |
| **Production API** | `https://api.cashfree.com/pg` |

### What Cashfree Does (if enabled):

Cashfree is a **second alternate payment gateway** — integrated alongside Razorpay and PhonePe. It is commonly used for UPI, card payments, and net banking in India and also supports international payments.

| Feature | Description |
|---------|-------------|
| **Order Creation** | Backend calls Cashfree to create a payment order |
| **Payment Session** | Cashfree returns a `payment_session_id` which opens the checkout |
| **Status Check** | Backend polls Cashfree to verify payment success |
| **Refunds** | Refunds processed via Cashfree dashboard or API |

### To Activate Cashfree, Add to `.env`:
```env
CASHFREE_APP_ID=your_app_id
CASHFREE_SECRET_KEY=your_secret_key
CASHFREE_MODE=sandbox   # or production
```

### Where to Manage:
- **Cashfree Dashboard:** [merchant.cashfree.com](https://merchant.cashfree.com)

---

## 6. Image & File Storage — Cloudinary

| Detail | Value |
|--------|-------|
| **Service** | Cloudinary (cloudinary.com) |
| **Cloud Name** | `b5ugi82g` |
| **API Key** | `784151348576325` |
| **Usage** | Image upload, storage, transformation, CDN delivery |

### What Cloudinary Does:

Cloudinary is the **image and media storage platform**. All images uploaded to the platform are stored on Cloudinary, not on the server.

### What Gets Uploaded to Cloudinary:

| Content | Cloudinary Folder |
|---------|------------------|
| Product images (main + gallery) | `Unnati Stores/products/` |
| Category images | `Unnati Stores/categories/` |
| Subcategory images | `Unnati Stores/subcategories/` |
| Seller logo/profile | `Unnati Stores/sellers/profile/` |
| Seller documents (ID proof, address proof) | `Unnati Stores/sellers/documents/` |
| Delivery agent photos | `Unnati Stores/delivery/` |
| Delivery agent documents | `Unnati Stores/delivery/documents/` |
| Coupon images | `Unnati Stores/coupons/` |
| Customer profile photos | `Unnati Stores/users/` |
| Store/shop images | `Unnati Stores/stores/` |
| Bill attachments | `Unnati Stores/` |

### How Uploads Work:
```
User selects image on frontend
      ↓
File sent to Backend API (multipart/form-data via Multer)
      ↓
Backend uploads to Cloudinary using SDK
      ↓
Cloudinary returns a secure URL (CDN URL)
      ↓
URL is saved in MongoDB
      ↓
Frontend loads image from Cloudinary CDN
```

### Environment Variables:
```env
CLOUDINARY_CLOUD_NAME=b5ugi82g
CLOUDINARY_API_KEY=784151348576325
CLOUDINARY_API_SECRET=h8-luzITWlKMJWjuphW_Aashveo
```

### Where to Manage:
- **Cloudinary Dashboard:** [cloudinary.com/console](https://cloudinary.com/console)
- View storage usage, manage folders, set transformations.
- Free tier: 25GB storage, 25GB monthly bandwidth.

---

## 6. Push Notifications — Firebase (FCM)

| Detail | Value |
|--------|-------|
| **Service** | Firebase Cloud Messaging (firebase.google.com) |
| **Project ID** | `Ecommerceapp-57a53` |
| **Project Name** | `Ecommerceapp-57a53` |
| **Auth Domain** | `Ecommerceapp-57a53.firebaseapp.com` |
| **Messaging Sender ID** | `152190840467` |
| **App ID** | `1:152190840467:web:def415cac1aa6f93af6766` |

### What Firebase (FCM) Does:

Firebase Cloud Messaging sends **real-time push notifications** to browsers and devices — even when the app is not open.

### Notifications Sent via Firebase:

| Trigger | Who Gets Notified |
|---------|------------------|
| New order placed | Seller |
| Order status changed | Customer |
| Order assigned to delivery agent | Delivery agent |
| Return request submitted | Seller + Admin |
| Withdrawal approved/rejected | Seller |
| Admin broadcasts announcement | Selected users (all/sellers/customers) |
| Flash deal goes live | Customers |

### How FCM Works:
```
Event happens (e.g., new order)
      ↓
Backend (Firebase Admin SDK) sends notification
      ↓
Firebase routes to specific user/device token
      ↓
Browser/device receives push notification
      ↓
User sees the notification even if app is closed
      ↓
(If app is open) → Toast notification shown in-app too
```

### Two Parts of Firebase:

**1. Firebase Admin SDK (Backend):**
- Used to **send** notifications from the server.
- Requires a Service Account JSON file stored at: `backend/config/firebase-service-account.json`
- File is NOT in the repository (sensitive — must be downloaded from Firebase Console).

**2. Firebase Client SDK (Frontend):**
- Used to **receive** notifications in the browser.
- Configured in [`frontend/src/firebase.ts`](file:///c:/Users/HP/Desktop/Unnati/frontend/src/firebase.ts)
- Uses a Service Worker (`firebase-messaging-sw.js`) to receive background notifications.

### Environment Variables (Frontend):
```
Firebase config is hardcoded in src/firebase.ts (public-safe config)
```

### Where to Manage:
- **Firebase Console:** [console.firebase.google.com](https://console.firebase.google.com)
- Project: `Ecommerceapp-57a53`
- Regenerate Service Account: Project Settings → Service Accounts → Generate new private key.
- View notification delivery logs under Cloud Messaging.

---

## 7. Maps & Location — Google Maps

| Detail | Value |
|--------|-------|
| **Service** | Google Maps Platform (maps.google.com) |
| **API Key** | `AIzaSyDaQfoCtcWZm4mLuSivwdcOzDKfkjS5SOw` |
| **APIs Used** | Maps JavaScript API, Places API, Geocoding API |

### What Google Maps Does:

| Feature | Description |
|---------|-------------|
| **Address Autocomplete** | As user types an address, suggestions appear (at checkout, seller signup, delivery signup) |
| **Location Picker** | Sellers and delivery agents pin their exact location on a map |
| **Live Order Tracking** | Customer sees delivery agent's location moving on a map in real time |
| **Reverse Geocoding** | Converts GPS coordinates (latitude, longitude) into a readable address |
| **Seller Location Map** | Admin sees all sellers on a map |

### Where Google Maps Appears:
- **Customer Checkout** — Address selection with autocomplete
- **Order Detail (Customer)** — Live tracking map while order is out for delivery
- **Seller Signup / Account Settings** — Location picker map
- **Delivery Signup / Profile** — Location picker map
- **Admin → Seller Location** — Map showing all seller locations

### Environment Variables:
```env
# Backend .env
VITE_GOOGLE_MAPS_API_KEY=AIzaSyDaQfoCtcWZm4mLuSivwdcOzDKfkjS5SOw

# Frontend .env
VITE_GOOGLE_MAPS_API_KEY=AIzaSyDaQfoCtcWZm4mLuSivwdcOzDKfkjS5SOw
```

### Where to Manage:
- **Google Cloud Console:** [console.cloud.google.com](https://console.cloud.google.com)
- Project → APIs & Services → Credentials → API Keys
- Enable APIs: Maps JavaScript API, Places API, Geocoding API
- Set API Key restrictions (restrict to your domain for security).

> ⚠️ **IMPORTANT:** Restrict the API key to your domain (`Unnati.today`) to prevent misuse by others. An unrestricted key can be exploited.

---

## 9. Maps Fallback — Leaflet.js + OpenStreetMap

| Detail | Value |
|--------|-------|
| **Mapping Library** | Leaflet.js + React-Leaflet |
| **Map Tiles Provider** | OpenStreetMap (free tile server) |
| **Geocoding Fallback** | Nominatim API — `https://nominatim.openstreetmap.org` |
| **Cost** | 100% FREE — no API key needed |

### What Leaflet.js Does:

Leaflet is a **lightweight open-source map library** used as a fallback when Google Maps is unavailable or as an alternate map renderer.

| Where It's Used | Purpose |
|----------------|--------|
| **Live Tracking Map** (`LiveTrackingMap.tsx`) | Shows delivery agent moving on map in real time |
| **Admin Seller Service Map** (`SellerServiceMap.tsx`) | Shows seller's service radius circle on a map |
| **Location Picker Map** (`LocationPickerMap.tsx`) | Lets users pick and pin their location |

### How It Works:
- Map tiles (the visual map images) are loaded from **OpenStreetMap's free tile server**.
- No API key needed — it's completely free to use.
- Works completely in the browser — no server calls needed for the map itself.

### Nominatim (Geocoding Fallback):
- If Google Maps Geocoding API fails → system silently switches to Nominatim.
- Converts GPS coordinates (latitude, longitude) → readable address text.
- Free public API — no registration or key required.

---

## 10. SMS & OTP — SMS India Hub

| Detail | Value |
|--------|-------|
| **Service** | SMS India Hub (smsindiahub.in) |
| **API URL** | `http://cloud.smsindiahub.in/vendorsms/pushsms.aspx` |
| **Status** | ⚠️ **Commented out in `.env`** — currently not active |

### What SMS India Hub Does:

SMS India Hub is configured to send **OTP (One-Time Password)** messages via SMS to Indian mobile numbers.

Used for:
- Customer registration OTP verification
- Customer login OTP
- Seller login OTP
- Delivery agent login OTP

### To Activate, Add to `.env`:
```env
OTP_PROVIDER=SMS_INDIA_HUB
SMS_INDIA_HUB_API_KEY=your_api_key
SMS_INDIA_HUB_SENDER_ID=YOURID
SMS_INDIA_HUB_DLT_TEMPLATE_ID=your_template_id
SMS_INDIA_HUB_API_URL=http://cloud.smsindiahub.in/vendorsms/pushsms.aspx
```

### Where to Manage:
- **SMS India Hub Dashboard:** [smsindiahub.in](http://smsindiahub.in)

---

## 11. SMS & OTP — 2Factor (Alternate)

| Detail | Value |
|--------|-------|
| **Service** | 2Factor.in (2factor.in) |
| **Status** | ⚠️ **Commented out in `.env`** — alternate option |
| **OTP Type** | Voice call OTP + SMS OTP |

### What 2Factor Does:

2Factor is an alternate **OTP provider** for Indian mobile numbers. It can deliver OTPs via:
- SMS text message
- **Voice call** (says the OTP number out loud — useful if SMS fails)

### To Activate, Add to `.env`:
```env
OTP_PROVIDER=2FACTOR_VOICE
TWOFACTOR_API_KEY=b02ae354-692e-11f0-a562-0200cd936042
```

### Current Status:
The `.env` has `OTP_PROVIDER=2FACTOR_VOICE` set but the API key is commented out. This means **OTP may be using mock/default OTP** in the current environment.

> 💡 **Default test OTP is: `1234`** (set in `.env` as a fallback for development)

---

## 12. Shipping — Shiprocket

| Detail | Value |
|--------|-------|
| **Service** | Shiprocket (shiprocket.in) |
| **API Endpoint** | `https://apiv2.shiprocket.in` |
| **Status** | ✅ **Integration UI built** — credentials entered via Admin Settings |

### What Shiprocket Does:

Shiprocket is a **third-party logistics aggregator** — it connects with 17+ courier companies (Blue Dart, DTDC, Delhivery, Ecom Express, etc.) to provide shipping for online orders.

| Feature | Description |
|---------|-------------|
| **Shipping Label Generation** | Generate printable shipping labels for orders |
| **Courier Selection** | Compare rates and choose best courier per order |
| **Tracking** | Track shipment across courier networks |
| **Pickup Scheduling** | Schedule courier pickup from seller's location |
| **Auto-AWB** | Airway Bill number generated automatically |
| **NDR Management** | Non-Delivery Report handling |
| **Rate Calculator** | Estimate shipping cost based on weight and destination |

### How to Configure:

1. Go to **Admin → App Settings → Shiprocket Integration tab**.
2. Enter your **Shiprocket Email** (registered Shiprocket account email).
3. Enter your **Shiprocket Password**.
4. API Base URL: `https://apiv2.shiprocket.in` (pre-filled).
5. Save — the system authenticates with Shiprocket and stores the token.

### Authentication Flow:
```
Admin saves Shiprocket credentials
      ↓
Backend calls: POST https://apiv2.shiprocket.in/v1/external/auth/login
      ↓
Shiprocket returns a Bearer token
      ↓
All subsequent Shiprocket API calls use this token
      ↓
Token is refreshed automatically when it expires
```

### Where to Manage:
- **Shiprocket Dashboard:** [app.shiprocket.in](https://app.shiprocket.in)
- Manage shipments, view reports, configure warehouses and pickup locations.

---

## 13. AI Search — Xenova Transformers

| Detail | Value |
|--------|-------|
| **Library** | `@xenova/transformers` v2.17.2 |
| **Model** | `Xenova/all-MiniLM-L6-v2` |
| **Type** | Local AI (runs ON the server — no external API call) |
| **Cost** | FREE — open source |

### What AI Search Does:

The platform uses a **local AI model** (no external API needed) to power **semantic/smart product search**.

Instead of matching only exact words, AI search understands the **meaning** of what the customer typed.

**Example:**
- Customer types: `"protein drink"`
- System finds: "Whey Protein Shake", "Health Supplement Drink", "Muscle Gainer" — even though the word "protein drink" may not exactly match those product names.

### How It Works:

```
Product is added/updated
      ↓
Backend generates a text description of the product
      ↓
AI model converts the text into a "vector embedding" (768 numbers)
      ↓
Embedding is saved in MongoDB with the product

When customer searches:
      ↓
Search query is converted to an embedding
      ↓
System compares query embedding with all product embeddings
      ↓
Products with similar meaning are ranked higher
      ↓
Results combine semantic score (35%) + keyword match (65%)
```

### Tech Details:
- **Model:** `all-MiniLM-L6-v2` — a lightweight, fast, open-source sentence transformer.
- **Algorithm:** Cosine Similarity (measures angle between two vectors).
- **Runs locally** on the backend server — no API key, no external cost.
- Model is downloaded automatically on first use via `@xenova/transformers`.

---

## 14. Google Custom Search API

| Detail | Value |
|--------|-------|
| **Service** | Google Custom Search JSON API |
| **API Endpoint** | `https://www.googleapis.com/customsearch/v1` |
| **Purpose** | Automatically find product images when seller adds a new product |
| **Status** | ⚠️ **Requires configuration** — set via Admin Settings or `.env` |

### What Google Custom Search Does:

When a seller adds a new product and doesn't have an image yet, they can click **"Search Image"** — this uses the Google Custom Search API to **automatically find a relevant product image** from the web.

| Feature | Description |
|---------|-------------|
| **Image Search** | Searches Google Images for the product name |
| **Smart Filtering** | Excludes stock photo sites (Unsplash, Pexels, Pixabay) to get original product images |
| **Single Result** | Returns the best matching large-size image |
| **Safe Search** | Always uses `safe=active` to filter inappropriate content |

### How It Works:
```
Seller types product name and clicks "Search Image"
      ↓
Backend calls Google Custom Search API with query:
"[product name] product india -site:unsplash.com -site:pexels.com"
      ↓
Google returns the top matching image URL
      ↓
Image URL is shown to seller for confirmation
      ↓
Seller accepts → image is uploaded to Cloudinary
```

### Setup Requirements:
1. Create a **Custom Search Engine** at [cse.google.com](https://cse.google.com)
2. Enable **Image Search** in the custom search engine settings.
3. Get the **Search Engine ID (CX ID)** from the settings.
4. Use the same **Google Cloud API Key** as Google Maps (or a separate key with Custom Search API enabled).

### Configuration (Admin Settings or `.env`):
```env
GOOGLE_CUSTOM_API_KEY=AIzaSy...   # Google Cloud API key with Custom Search enabled
GOOGLE_CX_ID=933cd3189f86843e3   # Your Custom Search Engine ID
```

**Or configure via Admin → App Settings → Google API tab.**

### Default CX ID in code: `933cd3189f86843e3`

---

## 15. Google Gemini AI API

| Detail | Value |
|--------|-------|
| **Service** | Google Gemini AI (ai.google.dev) |
| **Status** | ⚠️ **Commented out in `.env`** — optional/not currently active |
| **Purpose** | AI-powered product image finding (alternate to Google Custom Search) |

### What Gemini API Does:

Gemini is Google's AI model. In this project it was considered as an alternate way to **find product images** using AI — instead of a regular Google image search.

- Currently superseded by **Google Custom Search API** which is more reliable for this use case.
- The key is stored in `AppSettings` database so Admin can set it via the UI.

### To Activate (if needed), Add to `.env`:
```env
GEMINI_API_KEY=AIzaSyCiWNMexkg2h7bL0PwFXAAFYSNbb1ECQaQ
```

### Where to Get Key:
- **Google AI Studio:** [aistudio.google.com](https://aistudio.google.com)
- Free tier available with rate limits.

---

## 16. Real-Time Communication — Socket.IO

| Detail | Value |
|--------|-------|
| **Library** | Socket.IO v4.8.3 (backend) + socket.io-client v4.8.1 (frontend) |
| **Type** | WebSocket protocol (real-time bidirectional communication) |
| **Cost** | FREE — built into the backend server |

### What Socket.IO Does:

Socket.IO enables **instant real-time events** — actions that happen on one screen immediately appear on another without refreshing.

### Real-Time Events in the Platform:

| Event | Sender | Receiver | What Happens |
|-------|--------|----------|-------------|
| `new_order` | Customer places order | Seller | Seller sees new order notification instantly |
| `order_status_updated` | Seller/Admin updates status | Customer | Customer's order page updates in real time |
| `delivery_location_update` | Delivery agent's GPS | Customer | Live map updates as agent moves |
| `order_assigned` | Admin assigns delivery | Delivery agent | Agent receives assignment instantly |
| `notification` | Admin broadcasts | All/specific users | Push notification shown in-app |
| `payment_confirmed` | Payment gateway webhook | Seller | Seller notified of payment |

### How Socket.IO is Initialized:

- **Backend:** A Socket.IO server is attached to the Express HTTP server in [`server.ts`](file:///c:/Users/HP/Desktop/Unnati/backend/src/server.ts).
- **Frontend:** All portals (seller, admin, delivery, customer) connect to the Socket.IO server via `socket.io-client`.

---

## 17. Authentication — JWT (JSON Web Tokens)

| Detail | Value |
|--------|-------|
| **Library** | `jsonwebtoken` v9.0.3 |
| **Type** | Stateless token-based authentication |
| **Token Expiry** | 7 days (access token) + 7 days (refresh token) |
| **Cost** | FREE — open source library |

### What JWT Does:

JWT is how the platform knows **who is logged in** and what they are allowed to do.

When a user logs in:
1. Backend verifies their phone number + OTP/password.
2. Backend generates a **signed JWT token**.
3. Token is sent to the frontend.
4. Frontend stores the token and sends it with every API request (`Authorization: Bearer <token>`).
5. Backend verifies the token on every protected route.
6. Token expires after 7 days — user must log in again.

### Security:
- Tokens are signed with a secret key (stored in `.env`).
- Two secrets — one for access token, one for refresh token.
- If the secret changes, all existing tokens are invalidated (forces re-login).

### Environment Variables:
```env
JWT_SECRET=391d508f8c03e02deaf69eb24f73c7feb5592363...
JWT_REFRESH_SECRET=199a3009ccae5a7475cbf6c9cb43cffe...
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=7d
```

---

## 18. PDF Generation — jsPDF

| Detail | Value |
|--------|-------|
| **Library** | `jspdf` v4.1.0 + `jspdf-autotable` v5.0.7 |
| **Type** | Client-side (runs in the browser — no server needed) |
| **Cost** | FREE — open source |

### What jsPDF Does:

jsPDF is used to **generate PDF documents directly in the browser** — no backend call needed.

### Where PDF Generation Is Used:

| Feature | What PDF Contains |
|---------|------------------|
| **POS Bill / Invoice** | Complete bill with items, prices, taxes, store logo |
| **Supplier Ledger** | Supplier transaction history |
| **Customer Statement** | Customer purchase history and dues |
| **Sales Summary Report** | Sales report in table format |
| **Stock Reports** | Low stock, out of stock, loss summary |
| **GST Reports** | GST sales data in PDF format |
| **Return/Exchange Summary** | Returns report |
| **Payment Report** | Payment transactions table |
| **POS Report** | In-store sales summary |
| **Online Order Report** | Online orders with all details |

### Features Used:
- **Portrait and Landscape** orientations depending on content.
- **Auto-table** plugin for formatted data tables with borders and headers.
- Tables are styled with alternating row colors for readability.

---

## 19. Excel Export — xlsx Library

| Detail | Value |
|--------|-------|
| **Library** | `xlsx` v0.18.5 (SheetJS) |
| **Type** | Client-side (runs in browser) |
| **Cost** | FREE — open source |

### What xlsx Does:

The xlsx library generates **Excel (.xlsx) files** directly in the browser for data export and import.

### Where Excel Is Used:

**Export (Download as Excel):**
- All reports (Sales, GST, Stock, POS, Payments, Returns) can be downloaded as `.xlsx`.
- Storage Location data export.
- Product bulk edit export.

**Import (Upload Excel):**
- **Bulk Stock Import** — Upload Excel file to update stock for many products at once.
- **Storage Location Import** — Upload Excel to add warehouse locations in bulk.
- **Product Bulk Import** — Upload product data.

### Excel Template System:
- The system provides **downloadable template files** with correct columns pre-filled.
- Users fill in data and upload the file back.
- The system reads and processes the data row by row.

---

## 20. Rate Limiting — express-rate-limit

| Detail | Value |
|--------|-------|
| **Library** | `express-rate-limit` v8.2.1 |
| **Type** | Backend middleware |
| **Cost** | FREE — open source |

### What Rate Limiting Does:

Rate limiting **prevents abuse** of the API — if someone sends too many requests too quickly (like a bot or hacker), they are automatically blocked temporarily.

### Where It's Applied:
- **Search API routes** — limits how many searches per minute from one IP.
- Prevents search abuse and protects the AI embedding computation from overload.

### How It Works:
- Each IP address is tracked.
- If requests exceed the limit in a time window → returns `HTTP 429 Too Many Requests`.
- The requester must wait before trying again.

---

## 21. Frontend Deployment — Vercel

| Detail | Value |
|--------|-------|
| **Platform** | Vercel |
| **Production URL** | `https://Unnati.today` |
| **Deployment Method** | Git-connected auto-deploy |

### Vercel Configuration:
- Build command: `npm run build:vercel`
- All routes redirect to `index.html` (SPA routing).
- Security headers applied automatically.
- Assets cached for 1 year (immutable cache for JS/CSS/images).

### Where to Manage:
- **Vercel Dashboard:** [vercel.com/dashboard](https://vercel.com/dashboard)
- Add environment variables under Project → Settings → Environment Variables.

---

## 22. Backend Server — Node.js / Express

| Detail | Value |
|--------|-------|
| **Runtime** | Node.js |
| **Framework** | Express.js v4.22 |
| **Language** | TypeScript |
| **Port** | `5001` |
| **API Base Path** | `/api/v1/` |
| **Search API Path** | `/api/search/` |

### Backend API Endpoint Domains:

| Environment | API URL |
|-------------|---------|
| Development (Local) | `http://localhost:5001/api/v1` |
| Production | `https://api.Unnati.today/api/v1` |

### CORS (Who Can Access the API):

The API is configured to accept requests from:
- `http://localhost:5173` (local dev)
- `http://localhost:3000` (local dev)
- `https://Unnati.today` (production)
- `https://www.Unnati.today` (production)
- `https://api.Unnati.today` (API self)
- Any `*.vercel.app` domain (for preview deployments)

---

## 23. Email (SMTP Mail)

| Detail | Value |
|--------|-------|
| **Status** | ⚠️ **UI configured in Admin Settings** — SMTP credentials not in current `.env` |
| **Purpose** | Order confirmation emails, password reset emails |

### To Configure Email, Set Up in Admin:

Go to **Admin → App Settings → Mail Setting tab**:
- **Driver** (e.g., `smtp`)
- **Host** (e.g., `smtp.gmail.com` or `smtp.mailtrap.io`)
- **Port** (e.g., `587` for TLS, `465` for SSL)
- **Username** (email address)
- **Password** (SMTP password or App Password)
- **Encryption** (`tls` or `ssl`)
- **Mailer Name** (displayed as sender name)

### Popular SMTP Options:
- **Gmail:** Use "App Password" (not regular Gmail password).
- **Mailgun:** Best for transactional emails at scale.
- **SendGrid:** Alternative with free tier (100 emails/day).
- **Mailtrap:** For testing only (not real delivery).

---

## 24. Environment Variables Master Reference

### Backend `.env` Complete List:

```env
# ── DATABASE ──────────────────────────────────────────
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/Unnati-ecom

# ── SERVER ────────────────────────────────────────────
PORT=5001
NODE_ENV=development                     # or production

# ── AUTHENTICATION ────────────────────────────────────
JWT_SECRET=<long random string>
JWT_REFRESH_SECRET=<long random string>
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=7d

# ── PAYMENT GATEWAY (RAZORPAY) ────────────────────────
RAZORPAY_KEY_ID=rzp_test_...            # ⚠️ Change to live key for production
RAZORPAY_KEY_SECRET=...

# ── PAYMENT GATEWAY (PHONEPE - OPTIONAL) ─────────────
PHONEPE_MERCHANT_ID=your_id
PHONEPE_SALT_KEY=your_salt
PHONEPE_SALT_INDEX=1
PHONEPE_ENV=UAT                         # or PRODUCTION

# ── IMAGE STORAGE (CLOUDINARY) ────────────────────────
CLOUDINARY_CLOUD_NAME=b5ugi82g
CLOUDINARY_API_KEY=784151348576325
CLOUDINARY_API_SECRET=...

# ── MAPS (GOOGLE) ─────────────────────────────────────
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...

# ── SMS / OTP ─────────────────────────────────────────
OTP_PROVIDER=2FACTOR_VOICE              # or SMS_INDIA_HUB or MOCK
OTP_EXPIRY_MINUTES=5
TWOFACTOR_API_KEY=...                   # if using 2Factor
SMS_INDIA_HUB_API_KEY=...              # if using SMS India Hub
SMS_INDIA_HUB_SENDER_ID=...
SMS_INDIA_HUB_DLT_TEMPLATE_ID=...
USE_MOCK_OTP=false                      # set true for dev (OTP will be 1234)

# ── FRONTEND URL (for CORS) ───────────────────────────
FRONTEND_URL=https://Unnati.today
```

### Frontend `.env` Complete List:

```env
VITE_API_BASE_URL=http://localhost:5001/api/v1    # or https://api.Unnati.today/api/v1
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
```

---

## 25. Where Each API Key is Used — Summary Table

| API / Service | Used In | Purpose | Keys Needed | Cost |
|---------------|---------|---------|-------------|------|
| **MongoDB Atlas** | Backend | All data storage | `MONGODB_URI` | Free tier / Paid |
| **Razorpay** | Backend + Frontend | Primary online payment | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | 2% per transaction |
| **PhonePe** | Backend | Alternate payment gateway | `PHONEPE_MERCHANT_ID`, `PHONEPE_SALT_KEY` | Per transaction |
| **Cashfree** | Backend | Alternate payment gateway | `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` | Per transaction |
| **Cloudinary** | Backend | Image upload & CDN storage | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Free tier (25GB) |
| **Firebase FCM** | Backend + Frontend | Push notifications to browsers | Service Account JSON + Frontend config | Free |
| **Google Maps** | Frontend | Address autocomplete, live tracking, location picker | `VITE_GOOGLE_MAPS_API_KEY` | Free up to limits |
| **Leaflet.js** | Frontend | Alternate/fallback interactive maps | None (library) | Free |
| **OpenStreetMap Nominatim** | Frontend | Fallback reverse geocoding | None | Free |
| **SMS India Hub** | Backend | SMS OTP delivery | `SMS_INDIA_HUB_API_KEY`, `SMS_INDIA_HUB_SENDER_ID` | Per SMS |
| **2Factor** | Backend | Voice/SMS OTP delivery | `TWOFACTOR_API_KEY` | Per SMS/call |
| **Shiprocket** | Backend | Shipping label, courier, tracking | Email + Password (in Admin Settings) | Per shipment |
| **Xenova AI** | Backend | Smart semantic product search | None (runs locally) | Free |
| **Google Custom Search** | Backend | Product image auto-search for sellers | `GOOGLE_CUSTOM_API_KEY`, `GOOGLE_CX_ID` | Free (100/day) |
| **Gemini AI** | Backend | AI product image search (optional) | `GEMINI_API_KEY` | Free tier |
| **Socket.IO** | Backend + Frontend | Real-time events, live delivery tracking | None (built-in) | Free |
| **JWT** | Backend | User authentication tokens | `JWT_SECRET`, `JWT_REFRESH_SECRET` | Free |
| **jsPDF** | Frontend | PDF bill/report generation | None (library) | Free |
| **xlsx (SheetJS)** | Frontend | Excel export & import | None (library) | Free |
| **express-rate-limit** | Backend | API abuse prevention | None | Free |
| **Vercel** | Frontend hosting | Deploy & serve the web app | Vercel account | Free tier / Paid |

---

## 🔐 Security Checklist

Before going live, ensure:

- [ ] **Razorpay:** Switch from `rzp_test_...` to `rzp_live_...` keys
- [ ] **Google Maps API Key:** Restrict to `Unnati.today` domain only
- [ ] **Firebase:** Keep Service Account JSON file private (never commit to Git)
- [ ] **MongoDB URI:** Use a strong password for the database user
- [ ] **JWT Secrets:** Use long, random 64+ character strings
- [ ] **Cloudinary:** Set upload restrictions (only allow uploads from your server)
- [ ] **OTP Provider:** Set `USE_MOCK_OTP=false` in production
- [ ] **CORS:** Ensure only your domains are in the allowed origins list
- [ ] **Environment Variables:** Never commit `.env` files to Git (already in `.gitignore`)

---

## 📞 Support Links for Each Service

| Service | Dashboard | Documentation | Support |
|---------|-----------|--------------|---------|
| MongoDB Atlas | [cloud.mongodb.com](https://cloud.mongodb.com) | [docs.mongodb.com](https://docs.mongodb.com) | [support.mongodb.com](https://support.mongodb.com) |
| Razorpay | [dashboard.razorpay.com](https://dashboard.razorpay.com) | [razorpay.com/docs](https://razorpay.com/docs) | razorpay.com/support |
| Cloudinary | [cloudinary.com/console](https://cloudinary.com/console) | [cloudinary.com/documentation](https://cloudinary.com/documentation) | cloudinary.com/support |
| Firebase | [console.firebase.google.com](https://console.firebase.google.com) | [firebase.google.com/docs](https://firebase.google.com/docs) | firebase.google.com/support |
| Google Maps | [console.cloud.google.com](https://console.cloud.google.com) | [developers.google.com/maps](https://developers.google.com/maps) | Google Cloud Support |
| Shiprocket | [app.shiprocket.in](https://app.shiprocket.in) | [developers.shiprocket.com](https://developers.shiprocket.com) | support@shiprocket.com |
| Vercel | [vercel.com/dashboard](https://vercel.com/dashboard) | [vercel.com/docs](https://vercel.com/docs) | vercel.com/support |
| PhonePe | [business.phonepe.com](https://business.phonepe.com) | [developer.phonepe.com](https://developer.phonepe.com) | PhonePe Business Support |
