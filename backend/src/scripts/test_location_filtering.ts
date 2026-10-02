import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { findSellersWithinRange } from '../utils/locationHelper';
import Seller from '../models/Seller';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testLocationFiltering() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('✅ Connected to MongoDB');

  // 1. Indore Location test (Palasia: 22.7244, 75.8839)
  const indoreLat = 22.7244;
  const indoreLng = 75.8839;
  const indoreNearbySellerIds = await findSellersWithinRange(indoreLat, indoreLng);
  const indoreSellers = await Seller.find({
    _id: { $in: indoreNearbySellerIds },
    category: { $ne: 'Admin' }
  }).select('storeName city location').lean();

  console.log('\n--- INDORE USER LOCATION TEST ---');
  console.log(`User Coords: [${indoreLat}, ${indoreLng}]`);
  console.log(`Matching Nearby Stores (${indoreSellers.length}):`);
  indoreSellers.forEach(s => console.log(` - ${s.storeName} (${s.city})`));

  // 2. Hyderabad Location test (Banjara Hills: 17.4156, 78.4347)
  const hydLat = 17.4156;
  const hydLng = 78.4347;
  const hydNearbySellerIds = await findSellersWithinRange(hydLat, hydLng);
  const hydSellers = await Seller.find({
    _id: { $in: hydNearbySellerIds },
    category: { $ne: 'Admin' }
  }).select('storeName city location').lean();

  console.log('\n--- HYDERABAD USER LOCATION TEST ---');
  console.log(`User Coords: [${hydLat}, ${hydLng}]`);
  console.log(`Matching Nearby Stores (${hydSellers.length}):`);
  hydSellers.forEach(s => console.log(` - ${s.storeName} (${s.city})`));

  await mongoose.disconnect();
}

testLocationFiltering().catch(console.error);
