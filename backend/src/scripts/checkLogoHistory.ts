import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URIS = [
  process.env.MONGODB_URI,
  "mongodb+srv://playeronline4076_db_user:17UCetOw0K4CJWnH@cluster0.j5ccbjf.mongodb.net/Unnati-ecom?retryWrites=true&w=majority&appName=Cluster0",
  "mongodb+srv://harshgemini:harshgemini123@cluster0.qyctmev.mongodb.net/Unnati-ecom?retryWrites=true&w=majority",
  "mongodb+srv://aryankarma29_db_user:iR1609zqHSZRxUDx@cluster0.fi6wvqa.mongodb.net/Unnati-ecom",
  "mongodb+srv://allokfarms_db_user:RSWTY1kVcvGeOtje@cluster1.moyfuna.mongodb.net/Unnati-ecom?retryWrites=true&w=majority&appName=Cluster1"
].filter(Boolean) as string[];

async function checkLogoHistory() {
  for (const uri of URIS) {
    try {
      console.log("\nAttempting connection to URI:", uri.split('@')[1] || uri);
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log("Connected successfully!");

      const db = mongoose.connection.db;
      if (db) {
        const collection = db.collection('appsettings');
        const settingsList = await collection.find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray();

        console.log(`Found ${settingsList.length} AppSettings record(s):`);
        settingsList.forEach((doc, idx) => {
          console.log(`\n--- AppSetting #${idx + 1} ---`);
          console.log("ID          :", doc._id?.toString());
          console.log("App Name    :", doc.appName);
          console.log("App Logo    :", doc.appLogo);
          console.log("Created At  :", doc.createdAt ? new Date(doc.createdAt).toISOString() : 'N/A');
          console.log("Updated At  :", doc.updatedAt ? new Date(doc.updatedAt).toISOString() : 'N/A');
        });

        const logsCollection = db.collection('activitylogs');
        if (logsCollection) {
          const logoLogs = await logsCollection.find({
            $or: [
              { action: { $regex: 'logo', $options: 'i' } },
              { message: { $regex: 'logo', $options: 'i' } },
              { 'details.appLogo': { $exists: true } }
            ]
          }).sort({ createdAt: -1 }).limit(10).toArray();

          if (logoLogs.length) {
            console.log(`\nFound ${logoLogs.length} logo change activity log(s):`);
            console.log(JSON.stringify(logoLogs, null, 2));
          }
        }
      }
      await mongoose.disconnect();
      break;
    } catch (err: any) {
      console.error("Connection failed for URI:", err?.message || err);
      try { await mongoose.disconnect(); } catch {}
    }
  }
}

checkLogoHistory();
