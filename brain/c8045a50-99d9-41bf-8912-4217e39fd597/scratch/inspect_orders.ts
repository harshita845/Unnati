import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../backend/.env") });

import Order from "../backend/src/models/Order";

async function checkOrders() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/unnati";
  await mongoose.connect(uri);
  console.log("Connected to DB");

  const orders = await Order.find().sort({ createdAt: -1 }).limit(10).lean();
  console.log("Recent 10 orders:");
  for (const o of orders) {
    console.log(`OrderNum: ${o.orderNumber}, ID: ${o._id}, Status: ${o.status}, PaymentStatus: ${o.paymentStatus}, CreatedAt: ${o.createdAt}`);
  }

  await mongoose.disconnect();
}

checkOrders().catch(console.error);
