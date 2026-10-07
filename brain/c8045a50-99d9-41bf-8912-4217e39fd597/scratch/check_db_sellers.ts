import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/unnati';
  await mongoose.connect(uri);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const sellers = await mongoose.connection.db.collection('sellers').find({}).toArray();
  console.log('Sellers count in sellers collection:', sellers.length);
  console.log('Sellers:', sellers.map(s => ({ id: s._id, name: s.sellerName, store: s.storeName, city: s.city })));

  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log('Users count:', users.length);

  const stores = await mongoose.connection.db.collection('stores').find({}).toArray();
  console.log('Stores count:', stores.length);
  if (stores.length > 0) {
    console.log('Stores:', stores);
  }

  const storageLocations = await mongoose.connection.db.collection('storagelocations').find({}).toArray();
  console.log('StorageLocations count:', storageLocations.length);
  if (storageLocations.length > 0) {
    console.log('StorageLocations:', storageLocations.slice(0, 10));
  }

  await mongoose.disconnect();
}

run().catch(console.error);
