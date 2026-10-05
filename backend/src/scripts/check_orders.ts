import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Order from "../models/Order";

async function checkOrders() {
  const uri = process.env.MONGODB_URI || "";
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
