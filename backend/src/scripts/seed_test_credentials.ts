import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin';
import Seller from '../models/Seller';
import Delivery from '../models/Delivery';
import Customer from '../models/Customer';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://allokfarms_db_user:RSWTY1kVcvGeOtje@cluster1.moyfuna.mongodb.net/Unnati-ecom?retryWrites=true&w=majority&appName=Cluster1";

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.');

  // 1. Admin 9111966734
  const adminMobile = '9111966734';
  let admin = await Admin.findOne({ mobile: adminMobile });
  if (!admin) {
    admin = await Admin.create({
      firstName: 'Test',
      lastName: 'Admin',
      mobile: adminMobile,
      email: 'admin9111966734@ecommerce.com',
      role: 'Super Admin',
      password: 'AdminPassword@123',
    });
    console.log('Admin created:', adminMobile);
  } else {
    console.log('Admin already exists:', adminMobile);
  }

  // 2. Seller 9111966732
  const sellerMobile = '9111966732';
  let seller = await Seller.findOne({ mobile: sellerMobile });
  if (!seller) {
    seller = await Seller.create({
      sellerName: 'Test Seller',
      email: 'seller9111966732@ecommerce.com',
      mobile: sellerMobile,
      storeName: 'Test Seller Store',
      category: 'Grocery',
      address: 'Test Seller Address',
      city: 'Test City',
      status: 'Approved',
      isEnabled: true,
      canCreateCategories: true,
      requireProductApproval: false,
      commission: 0,
      balance: 0,
      categories: ['Grocery'],
    });
    console.log('Seller created:', sellerMobile);
  } else {
    console.log('Seller already exists:', sellerMobile);
  }

  // 3. Delivery 9111966733
  const deliveryMobile = '9111966733';
  let delivery = await Delivery.findOne({ mobile: deliveryMobile });
  if (!delivery) {
    delivery = await Delivery.create({
      name: 'Test Delivery',
      email: 'delivery9111966733@ecommerce.com',
      mobile: deliveryMobile,
      password: 'DeliveryPassword@123',
      address: 'Test Delivery Address',
      city: 'Test City',
      status: 'Active',
      isOnline: true,
      balance: 0,
      cashCollected: 0,
      settings: {
        notifications: true,
        location: true,
        sound: true,
      },
    });
    console.log('Delivery created:', deliveryMobile);
  } else {
    console.log('Delivery already exists:', deliveryMobile);
  }

  // 4. Customer 9111966731
  const customerMobile = '9111966731';
  let customer = await Customer.findOne({ phone: customerMobile, sellerId: null });
  if (!customer) {
    customer = await Customer.create({
      name: 'Test Customer',
      email: 'customer9111966731@ecommerce.com',
      phone: customerMobile,
      status: 'Active',
      totalOrders: 0,
      totalSpent: 0,
      creditBalance: 0,
    });
    console.log('Customer created:', customerMobile);
  } else {
    console.log('Customer already exists:', customerMobile);
  }

  await mongoose.connection.close();
  console.log('Disconnected.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
