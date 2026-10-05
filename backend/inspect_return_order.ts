import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import DeliveryAssignment from './src/models/DeliveryAssignment';
import './src/models/Order';
import './src/models/OrderItem';
import './src/models/Product';
import './src/models/Return';

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Connected to MongoDB');

  const deliveryId = '6abcb6bf965ee483c9296a2f';

  const assignments = await DeliveryAssignment.find({
    deliveryBoy: deliveryId,
    assignmentType: { $in: ["Return", "Replacement"] },
    status: { $in: ["Assigned", "Accepted", "Picked Up", "In Transit"] }
  }).populate({
    path: "returnRequest",
    populate: [
      { path: "order", select: "orderNumber items customerName customerPhone deliveryAddress" },
      { path: "orderItem", populate: { path: "product", select: "productName mainImage" } }
    ]
  });

  console.log('=== POPULATED ASSIGNMENTS ===');
  console.log(JSON.stringify(assignments, null, 2));

  await mongoose.disconnect();
}

check().catch(console.error);
