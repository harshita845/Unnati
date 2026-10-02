import mongoose from 'mongoose';
import Seller from '../models/Seller';
import Shop from '../models/Shop';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGODB_URI found in env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const sellers = await Seller.find({}).lean();
  console.log('=== SELLERS ===');
  console.log(JSON.stringify(sellers.map(s => ({
    _id: s._id,
    sellerName: s.sellerName,
    storeName: s.storeName,
    city: s.city,
    isEnabled: s.isEnabled,
    status: s.status,
    category: s.category,
    coordinates: s.location?.coordinates
  })), null, 2));

  const shops = await Shop.find({}).lean();
  console.log('=== SHOPS (Admin collections) ===');
  console.log(JSON.stringify(shops, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
