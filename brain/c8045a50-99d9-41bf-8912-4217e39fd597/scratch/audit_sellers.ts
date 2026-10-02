import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../backend/.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function auditSellers() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB:', mongoose.connection.name);

  const db = mongoose.connection.db;
  if (!db) {
    console.error('No DB connection');
    process.exit(1);
  }

  // 1. Inspect sellers
  const sellersColl = db.collection('sellers');
  const allSellers = await sellersColl.find({}).toArray();
  console.log(`\n=== SELLERS IN DB (${allSellers.length}) ===`);
  for (const s of allSellers) {
    const productsCount = await db.collection('products').countDocuments({
      seller: s._id,
      status: 'Active',
      publish: true
    });
    console.log({
      id: s._id.toString(),
      sellerName: s.sellerName,
      storeName: s.storeName,
      mobile: s.mobile,
      email: s.email,
      status: s.status,
      isEnabled: s.isEnabled,
      location: s.location,
      serviceRadiusKm: s.serviceRadiusKm,
      activePublishedProducts: productsCount
    });
  }

  // 2. Inspect shops collection
  const shopsColl = db.collection('shops');
  const allShops = await shopsColl.find({}).toArray();
  console.log(`\n=== SHOPS (SHOP-BY-STORE) IN DB (${allShops.length}) ===`);
  for (const sh of allShops) {
    console.log({
      id: sh._id.toString(),
      storeId: sh.storeId,
      name: sh.name,
      isActive: sh.isActive,
      productsAssigned: sh.products ? sh.products.length : 0
    });
  }

  await mongoose.disconnect();
}

auditSellers().catch(console.error);
