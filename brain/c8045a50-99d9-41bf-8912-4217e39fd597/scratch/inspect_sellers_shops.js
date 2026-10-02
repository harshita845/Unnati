const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/unnati';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const sellers = await db.collection('sellers').find({}).toArray();
  console.log('=== SELLERS ===');
  console.log(sellers.map(s => ({
    _id: s._id,
    storeName: s.storeName,
    sellerName: s.sellerName,
    city: s.city,
    location: s.location,
    isEnabled: s.isEnabled,
    status: s.status,
    category: s.category
  })));

  const shops = await db.collection('shops').find({}).toArray();
  console.log('=== SHOPS ===');
  console.log(shops);

  await mongoose.disconnect();
}

main().catch(console.error);
