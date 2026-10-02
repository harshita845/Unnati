import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkDeliveryStaff() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db;
  const deliveries = await db!.collection('deliveries').find({}).toArray();
  console.log(`=== DELIVERY STAFF IN DB (${deliveries.length}) ===`);
  for (const d of deliveries) {
    console.log(JSON.stringify({
      id: d._id.toString(),
      name: d.name,
      mobile: d.mobile,
      email: d.email,
      status: d.status,
      isOnline: d.isOnline,
      createdAt: d.createdAt
    }, null, 2));
  }
  await mongoose.disconnect();
}

checkDeliveryStaff().catch(console.error);
