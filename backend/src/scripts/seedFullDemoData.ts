import dns from "dns";
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Admin from "../models/Admin";
import Seller from "../models/Seller";
import Product from "../models/Product";
import Customer from "../models/Customer";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Return from "../models/Return";
import CashCollection from "../models/CashCollection";
import InventoryLoss from "../models/InventoryLoss";
import GSTReportEntry from "../models/GSTReportEntry";
import WithdrawRequest from "../models/WithdrawRequest";
import WalletTransaction from "../models/WalletTransaction";
import AdminPurchaseEntry from "../models/AdminPurchaseEntry";
import SellerPurchaseEntry from "../models/SellerPurchaseEntry";
import SupplierLedger from "../models/SupplierLedger";
import SupplierTransaction, { SupplierTransactionType } from "../models/SupplierTransaction";
import CreditTransaction from "../models/CreditTransaction";
import Coupon from "../models/Coupon";
import FreeGiftRule from "../models/FreeGiftRule";
import Policy from "../models/Policy";
import FAQ from "../models/FAQ";
import StorageLocation from "../models/StorageLocation";
import Attribute from "../models/Attribute";
import VariationType from "../models/VariationType";
import Brand from "../models/Brand";
import Cart from "../models/Cart";
import CartItem from "../models/CartItem";
import Delivery from "../models/Delivery";

async function runSeed() {
  console.log("\n========================================================");
  console.log("🚀 STARTING COMPREHENSIVE DEMO DATA SEEDING");
  console.log("========================================================\n");

  await mongoose.connect(process.env.MONGODB_URI!);
  console.log("✓ Connected to MongoDB\n");

  // ==========================================
  // 1. ADMIN SETUP & VERIFICATION
  // ==========================================
  console.log("--- 1. Ensuring Admin Account ---");
  let admin = await Admin.findOne({
    $or: [{ email: "admin9111966734@ecommerce.com" }, { mobile: "9111966734" }],
  });

  if (!admin) {
    const hashedPassword = await bcrypt.hash("1234", 10);
    admin = await Admin.create({
      firstName: "Super",
      lastName: "Admin",
      email: "admin9111966734@ecommerce.com",
      mobile: "9111966734",
      password: hashedPassword,
      role: "Super Admin",
      status: "Active",
      permissions: ["*"],
    });
    console.log("✓ Created Default Super Admin (9111966734)");
  } else {
    admin.role = "Super Admin";
    await admin.save();
    console.log(`✓ Admin Verified: ${admin.email} (ID: ${admin._id})`);
  }

  // ==========================================
  // 2. SELLER SETUP & ENRICHMENT
  // ==========================================
  const matchingSellers = await Seller.find({
    $or: [{ mobile: "9111966732" }, { email: "seller9111966732@ecommerce.com" }],
  });

  let testSeller: any;
  if (matchingSellers.length > 1) {
    testSeller = matchingSellers[0];
    for (let j = 1; j < matchingSellers.length; j++) {
      await Seller.deleteOne({ _id: matchingSellers[j]._id });
    }
  } else if (matchingSellers.length === 1) {
    testSeller = matchingSellers[0];
  }

  if (!testSeller) {
    const hashedPassword = await bcrypt.hash("1234", 10);
    testSeller = await Seller.create({
      sellerName: "Test Seller",
      storeName: "Test Seller Store",
      email: "seller9111966732@ecommerce.com",
      mobile: "9111966732",
      password: hashedPassword,
      category: "Grocery & Gourmet",
      address: "Shop 12, Station Road, Nagda",
      city: "Nagda",
      latitude: "23.4567",
      longitude: "75.4321",
      searchLocation: "Station Road, Nagda, MP",
      serviceRadiusKm: 15,
      panCard: "ABCDE1234F",
      taxNumber: "23ABCDE1234F1Z5",
      fssaiLicNo: "10020030004000",
      bankName: "State Bank of India",
      accountName: "Test Seller Store",
      accountNumber: "34567890123",
      ifsc: "SBIN0001234",
      branch: "Nagda Main Branch",
      balance: 28450,
      status: "Approved",
      isEnabled: true,
      canCreateCategories: true,
      commission: 5,
      billSettings: {
        shopName: "Test Seller Store",
        address: "Shop 12, Station Road, Nagda",
        phone: "9111966732",
        notes: { text: "Thank you for shopping with Test Seller Store!", enabled: true },
        terms: { text: "Goods once sold can be returned within 2 days with bill.", enabled: true },
        gst: { text: "23ABCDE1234F1Z5", enabled: true },
        fssai: { text: "10020030004000", enabled: true },
      },
    });
    console.log("✓ Created Test Seller (9111966732)");
  } else {
    testSeller.status = "Approved";
    testSeller.isEnabled = true;
    testSeller.latitude = testSeller.latitude || "23.4567";
    testSeller.longitude = testSeller.longitude || "75.4321";
    testSeller.searchLocation = testSeller.searchLocation || "Station Road, Nagda, MP";
    testSeller.serviceRadiusKm = testSeller.serviceRadiusKm || 15;
    testSeller.city = testSeller.city || "Nagda";
    testSeller.address = testSeller.address || "Shop 12, Station Road, Nagda";
    testSeller.panCard = testSeller.panCard || "ABCDE1234F";
    testSeller.taxNumber = testSeller.taxNumber || "23ABCDE1234F1Z5";
    testSeller.fssaiLicNo = testSeller.fssaiLicNo || "10020030004000";
    testSeller.bankName = testSeller.bankName || "State Bank of India";
    testSeller.accountName = testSeller.accountName || "Test Seller Store";
    testSeller.accountNumber = testSeller.accountNumber || "34567890123";
    testSeller.ifsc = testSeller.ifsc || "SBIN0001234";
    testSeller.branch = testSeller.branch || "Nagda Main Branch";
    testSeller.balance = Math.max(testSeller.balance || 0, 28450);
    testSeller.billSettings = {
      shopName: testSeller.storeName || "Test Seller Store",
      address: testSeller.address || "Shop 12, Station Road, Nagda",
      phone: testSeller.mobile || "9111966732",
      notes: { text: "Thank you for shopping with us!", enabled: true },
      terms: { text: "Goods once sold can be returned within 2 days with bill.", enabled: true },
      gst: { text: testSeller.taxNumber || "23ABCDE1234F1Z5", enabled: true },
      fssai: { text: testSeller.fssaiLicNo || "10020030004000", enabled: true },
    };
    await testSeller.save();
    console.log(`✓ Test Seller Updated: ${testSeller.storeName} (ID: ${testSeller._id})`);
  }

  // Update all other sellers with location coordinates if missing
  const allSellers = await Seller.find({});
  const sellerLocations = [
    { city: "Nagda", lat: "23.4567", lng: "75.4321", loc: "Station Road, Nagda" },
    { city: "Nagda", lat: "23.4612", lng: "75.4289", loc: "Main Bazar, Nagda" },
    { city: "Ujjain", lat: "23.1765", lng: "75.7885", loc: "Freeganj, Ujjain" },
    { city: "Indore", lat: "22.7196", lng: "75.8577", loc: "Rajwada, Indore" },
    { city: "Ratlam", lat: "23.3315", lng: "75.0367", loc: "Station Road, Ratlam" },
  ];

  for (let i = 0; i < allSellers.length; i++) {
    const s = allSellers[i];
    const loc = sellerLocations[i % sellerLocations.length];
    s.latitude = s.latitude || loc.lat;
    s.longitude = s.longitude || loc.lng;
    s.city = s.city || loc.city;
    s.searchLocation = s.searchLocation || loc.loc;
    s.serviceRadiusKm = s.serviceRadiusKm || 12;
    s.taxNumber = s.taxNumber || `23ABCDE${1000 + i}F1Z5`;
    s.panCard = s.panCard || `ABCDE${1000 + i}F`;
    s.fssaiLicNo = s.fssaiLicNo || `1002003000${4000 + i}`;
    s.bankName = s.bankName || "HDFC Bank";
    s.accountNumber = s.accountNumber || `501000${200000 + i}`;
    s.ifsc = s.ifsc || "HDFC0001234";
    await s.save();
  }
  console.log(`✓ Enriched ${allSellers.length} Sellers with coordinates, tax & bank info`);

  // ==========================================
  // 3. STORAGE LOCATIONS SETUP
  // ==========================================
  console.log("\n--- 3. Setting Up Storage Locations ---");
  const adminStorageRacks = [
    { level: "rack", name: "Rack A-01", city: "Nagda", warehouse: "Central Hub", room: "Room 1", rackNumber: "A-01", code: "WH-RACK-A01", createdBy: "Admin" },
    { level: "rack", name: "Rack A-02", city: "Nagda", warehouse: "Central Hub", room: "Room 1", rackNumber: "A-02", code: "WH-RACK-A02", createdBy: "Admin" },
    { level: "rack", name: "Rack B-01", city: "Nagda", warehouse: "Central Hub", room: "Room 2", rackNumber: "B-01", code: "WH-RACK-B01", createdBy: "Admin" },
    { level: "rack", name: "Rack B-02", city: "Nagda", warehouse: "Central Hub", room: "Room 2", rackNumber: "B-02", code: "WH-RACK-B02", createdBy: "Admin" },
    { level: "rack", name: "Cold Storage Zone 1", city: "Nagda", warehouse: "Cold Storage Unit", room: "Cold Room A", rackNumber: "CS-01", code: "CS-UNIT-01", createdBy: "Admin" },
    { level: "rack", name: "Shelf 01", city: "Nagda", warehouse: "Central Hub", room: "Front Display", rackNumber: "SH-01", code: "SH-01", createdBy: "Admin" },
    { level: "rack", name: "Shelf 02", city: "Nagda", warehouse: "Central Hub", room: "Front Display", rackNumber: "SH-02", code: "SH-02", createdBy: "Admin" },
  ];

  for (const st of adminStorageRacks) {
    const exists = await StorageLocation.findOne({ name: st.name, createdBy: "Admin" });
    if (!exists) {
      await StorageLocation.create(st);
    }
  }

  const sellerStorageRacks = [
    { level: "rack", name: "Seller Rack S-01", city: "Nagda", warehouse: "Store Room", room: "Main Room", rackNumber: "S-01", code: "SLR-S01", createdBy: "Seller", sellerId: testSeller._id },
    { level: "rack", name: "Seller Rack S-02", city: "Nagda", warehouse: "Store Room", room: "Main Room", rackNumber: "S-02", code: "SLR-S02", createdBy: "Seller", sellerId: testSeller._id },
    { level: "rack", name: "Seller Shelf 01", city: "Nagda", warehouse: "Store Room", room: "Aisle A", rackNumber: "SLR-SH01", code: "SLR-SH01", createdBy: "Seller", sellerId: testSeller._id },
    { level: "rack", name: "Seller Shelf 02", city: "Nagda", warehouse: "Store Room", room: "Aisle B", rackNumber: "SLR-SH02", code: "SLR-SH02", createdBy: "Seller", sellerId: testSeller._id },
  ];

  for (const st of sellerStorageRacks) {
    const exists = await StorageLocation.findOne({ name: st.name, sellerId: testSeller._id });
    if (!exists) {
      await StorageLocation.create(st);
    }
  }
  console.log("✓ Seeded Admin and Seller Storage / Rack Locations");

  // ==========================================
  // 4. PRODUCT CATALOG ASSIGNMENT & STOCK TUNING
  // ==========================================
  console.log("\n--- 4. Assigning Products to Seller & Tuning Stock ---");
  const allProducts = await Product.find({ status: "Active" }).limit(80);
  console.log(`Found ${allProducts.length} active products to work with.`);

  const rackNames = ["Rack A-01", "Rack A-02", "Rack B-01", "Rack B-02", "Shelf 01", "Shelf 02", "Cold Storage Zone 1"];

  const storageLocObjects = [
    { city: "Nagda", warehouse: "Central Hub", room: "Room 1", rackNumber: "A-01" },
    { city: "Nagda", warehouse: "Central Hub", room: "Room 1", rackNumber: "A-02" },
    { city: "Nagda", warehouse: "Central Hub", room: "Room 2", rackNumber: "B-01" },
    { city: "Nagda", warehouse: "Central Hub", room: "Room 2", rackNumber: "B-02" },
    { city: "Nagda", warehouse: "Central Hub", room: "Front Display", rackNumber: "SH-01" },
    { city: "Nagda", warehouse: "Central Hub", room: "Front Display", rackNumber: "SH-02" },
    { city: "Nagda", warehouse: "Cold Storage Unit", room: "Cold Room A", rackNumber: "CS-01" },
  ];

  for (let i = 0; i < allProducts.length; i++) {
    const prod = allProducts[i];
    const locObj = storageLocObjects[i % storageLocObjects.length];

    let targetStock = Math.floor(Math.random() * 80) + 30;
    if (i % 12 === 0) {
      targetStock = 0; // Out of stock
    } else if (i % 7 === 0) {
      targetStock = Math.floor(Math.random() * 3) + 1; // Low stock (1-3)
    }

    const updateFields: any = {
      storageLocation: locObj,
      lowStockQuantity: 5,
      costPrice: (prod as any).costPrice || Math.round((prod.price || 100) * 0.75),
      hsnCode: prod.hsnCode || (i % 2 === 0 ? "1905" : "2106"),
      stock: targetStock,
    };

    if (i < 40) {
      updateFields.seller = testSeller._id;
    }

    if (prod.variations && prod.variations.length > 0) {
      const updatedVariations = prod.variations.map((v: any, vIdx: number) => ({
        ...(v.toObject ? v.toObject() : v),
        stock: vIdx === 0 ? targetStock : Math.floor(Math.random() * 20) + 5,
        rackNumber: locObj.rackNumber,
      }));
      updateFields.variations = updatedVariations;
    } else {
      updateFields.variations = [
        {
          value: "Standard",
          price: prod.price || 100,
          discPrice: prod.discPrice || prod.price || 100,
          stock: targetStock,
          sku: prod.sku || `SKU-${prod._id.toString().slice(-4)}`,
          rackNumber: locObj.rackNumber,
          barcode: [`BAR${prod._id.toString().slice(-6)}`],
        },
      ];
    }

    await Product.updateOne({ _id: prod._id }, { $set: updateFields });
  }
  console.log("✓ Assigned 40 products to Test Seller and tuned stock levels (In Stock, Low Stock, Out of Stock).");

  // ==========================================
  // 5. CUSTOMERS & CREDIT LEDGER SETUP
  // ==========================================
  console.log("\n--- 5. Setting Up Admin & Seller Customers with Credit Ledgers ---");
  const adminCustomersData = [
    { name: "Rahul Sharma", email: "rahul.sharma@example.com", phone: "9826011111", city: "Nagda", address: "14, Jawahar Marg", creditBalance: 1450, totalOrders: 18, totalSpent: 14200 },
    { name: "Priya Patel", email: "priya.patel@example.com", phone: "9826022222", city: "Nagda", address: "25, Shanti Nagar", creditBalance: 3200, totalOrders: 24, totalSpent: 28500 },
    { name: "Amit Verma", email: "amit.verma@example.com", phone: "9826033333", city: "Nagda", address: "78, Station Road", creditBalance: 0, totalOrders: 12, totalSpent: 9800 },
    { name: "Pooja Gupta", email: "pooja.gupta@example.com", phone: "9826044444", city: "Ujjain", address: "102, Freeganj", creditBalance: 850, totalOrders: 15, totalSpent: 16400 },
    { name: "Vikram Singh", email: "vikram.singh@example.com", phone: "9826055555", city: "Nagda", address: "44, Birla Gram", creditBalance: 0, totalOrders: 32, totalSpent: 42100 },
    { name: "Anjali Mehta", email: "anjali.mehta@example.com", phone: "9826066666", city: "Nagda", address: "19, Civil Lines", creditBalance: 2100, totalOrders: 8, totalSpent: 7500 },
    { name: "Rajesh Kumar", email: "rajesh.kumar@example.com", phone: "9826077777", city: "Indore", address: "55, Vijay Nagar", creditBalance: 0, totalOrders: 5, totalSpent: 4300 },
    { name: "Sneha Jain", email: "sneha.jain@example.com", phone: "9826088888", city: "Nagda", address: "8, Mahavir Marg", creditBalance: 600, totalOrders: 21, totalSpent: 19800 },
  ];

  const adminCustomers: any[] = [];
  for (const c of adminCustomersData) {
    let cust = await Customer.findOne({ $or: [{ phone: c.phone }, { email: c.email }] });
    if (!cust) {
      cust = await Customer.create({
        ...c,
        status: "Active",
        registrationDate: new Date(Date.now() - Math.random() * 90 * 24 * 3600 * 1000),
        sellerId: null,
      });
    } else {
      cust.name = c.name;
      cust.address = c.address;
      cust.city = c.city;
      cust.creditBalance = c.creditBalance;
      cust.totalOrders = c.totalOrders;
      cust.totalSpent = c.totalSpent;
      cust.sellerId = null;
      await cust.save();
    }
    adminCustomers.push(cust);

    // Seed credit transactions if customer has dues
    if (c.creditBalance > 0) {
      const txExists = await CreditTransaction.findOne({ customer: cust._id });
      if (!txExists) {
        await CreditTransaction.create({
          customer: cust._id,
          type: "Order",
          amount: c.creditBalance + 1000,
          balanceAfter: c.creditBalance + 1000,
          description: "POS Credit Purchase Bill #POS-8891",
          referenceId: "POS-8891",
          date: new Date(Date.now() - 5 * 24 * 3600 * 1000),
          createdBy: admin._id,
        });
        await CreditTransaction.create({
          customer: cust._id,
          type: "Payment",
          amount: -1000,
          balanceAfter: c.creditBalance,
          description: "Cash Payment received against dues",
          referenceId: "REC-9912",
          date: new Date(Date.now() - 2 * 24 * 3600 * 1000),
          createdBy: admin._id,
        });
      }
    }
  }

  const sellerCustomersData = [
    { name: "Vikas Patidar", email: "vikas.patidar@example.com", phone: "9755011111", city: "Nagda", address: "12, Krishi Mandi Road", creditBalance: 1200, totalOrders: 14, totalSpent: 11500 },
    { name: "Sandeep Chouhan", email: "sandeep.chouhan@example.com", phone: "9755022222", city: "Nagda", address: "45, Bypass Road", creditBalance: 2400, totalOrders: 19, totalSpent: 18900 },
    { name: "Meena Rathore", email: "meena.rathore@example.com", phone: "9755033333", city: "Nagda", address: "67, Mandi Gate", creditBalance: 0, totalOrders: 9, totalSpent: 8200 },
    { name: "Deepak Soni", email: "deepak.soni@example.com", phone: "9755044444", city: "Nagda", address: "23, Sarafa Bazar", creditBalance: 950, totalOrders: 22, totalSpent: 24600 },
    { name: "Kavita Porwal", email: "kavita.porwal@example.com", phone: "9755055555", city: "Nagda", address: "88, Main Market", creditBalance: 0, totalOrders: 11, totalSpent: 9100 },
    { name: "Gaurav Jain", email: "gaurav.jain@example.com", phone: "9755066666", city: "Nagda", address: "31, Mahavir Colony", creditBalance: 1800, totalOrders: 16, totalSpent: 15400 },
  ];

  const sellerCustomers: any[] = [];
  for (const c of sellerCustomersData) {
    let cust = await Customer.findOne({ $or: [{ phone: c.phone }, { email: c.email }] });
    if (!cust) {
      cust = await Customer.create({
        ...c,
        status: "Active",
        registrationDate: new Date(Date.now() - Math.random() * 60 * 24 * 3600 * 1000),
        sellerId: testSeller._id,
      });
    } else {
      cust.name = c.name;
      cust.address = c.address;
      cust.city = c.city;
      cust.creditBalance = c.creditBalance;
      cust.totalOrders = c.totalOrders;
      cust.totalSpent = c.totalSpent;
      cust.sellerId = testSeller._id;
      await cust.save();
    }
    sellerCustomers.push(cust);

    if (c.creditBalance > 0) {
      const txExists = await CreditTransaction.findOne({ customer: cust._id });
      if (!txExists) {
        await CreditTransaction.create({
          customer: cust._id,
          type: "Order",
          amount: c.creditBalance + 800,
          balanceAfter: c.creditBalance + 800,
          description: "Seller POS Credit Bill #SPOS-1024",
          referenceId: "SPOS-1024",
          date: new Date(Date.now() - 4 * 24 * 3600 * 1000),
        });
        await CreditTransaction.create({
          customer: cust._id,
          type: "Payment",
          amount: -800,
          balanceAfter: c.creditBalance,
          description: "UPI Payment received from customer",
          referenceId: "SPAY-2048",
          date: new Date(Date.now() - 1 * 24 * 3600 * 1000),
        });
      }
    }
  }
  console.log(`✓ Seeded ${adminCustomers.length} Admin Customers and ${sellerCustomers.length} Seller Customers with Credit Ledgers.`);

  // ==========================================
  // 6. SUPPLIERS & SUPPLIER TRANSACTIONS SETUP
  // ==========================================
  console.log("\n--- 6. Setting Up Admin & Seller Suppliers with Ledgers ---");
  const adminSuppliersData = [
    { name: "Mahalaxmi Traders", phone: "9893011111", address: "Grain Market, Indore", gstNumber: "23AABCM1111A1Z1", openingBalance: 45000, currentBalance: 32000, isAdmin: true },
    { name: "Shree Balaji Wholesalers", phone: "9893022222", address: "Dawa Bazar, Ujjain", gstNumber: "23AABCS2222B1Z2", openingBalance: 28000, currentBalance: 18500, isAdmin: true },
    { name: "National FMCG Distributors", phone: "9893033333", address: "Transport Nagar, Indore", gstNumber: "23AABCN3333C1Z3", openingBalance: 65000, currentBalance: 48000, isAdmin: true },
    { name: "Kailash Packaging Mart", phone: "9893044444", address: "Industrial Area, Nagda", gstNumber: "23AABCK4444D1Z4", openingBalance: 12000, currentBalance: 7500, isAdmin: true },
    { name: "Vardhman Spices & Oils", phone: "9893055555", address: "Sarafa Bazar, Ratlam", gstNumber: "23AABCV5555E1Z5", openingBalance: 35000, currentBalance: 22000, isAdmin: true },
  ];

  for (const s of adminSuppliersData) {
    let supp = await SupplierLedger.findOne({ phone: s.phone, isAdmin: true });
    if (!supp) {
      supp = await SupplierLedger.create(s);
    } else {
      supp.currentBalance = s.currentBalance;
      await supp.save();
    }

    const txExists = await SupplierTransaction.findOne({ supplier: supp._id });
    if (!txExists) {
      await SupplierTransaction.create({
        supplier: supp._id,
        type: SupplierTransactionType.PURCHASE,
        amount: 25000,
        balanceAfter: s.currentBalance + 15000,
        description: "Stock Inward Invoice #INV-5541",
        date: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      });
      await SupplierTransaction.create({
        supplier: supp._id,
        type: SupplierTransactionType.PAYMENT,
        amount: -15000,
        balanceAfter: s.currentBalance,
        description: "NEFT Bank Payment ref #UTR887192",
        date: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      });
    }
  }

  const sellerSuppliersData = [
    { name: "Nagda Local Staples Supplier", phone: "9425011111", address: "Mandi Road, Nagda", gstNumber: "23AABCN5555A1Z1", openingBalance: 18000, currentBalance: 12000, sellerId: testSeller._id, isAdmin: false },
    { name: "Ujjain Dairy & Beverage Co.", phone: "9425022222", address: "Freeganj, Ujjain", gstNumber: "23AABCU6666B1Z2", openingBalance: 14000, currentBalance: 8500, sellerId: testSeller._id, isAdmin: false },
    { name: "Malwa Agro Food Supply", phone: "9425033333", address: "Maksi Road, Ujjain", gstNumber: "23AABCM7777C1Z3", openingBalance: 22000, currentBalance: 16000, sellerId: testSeller._id, isAdmin: false },
    { name: "Krishna Oil & Ghee Mart", phone: "9425044444", address: "Sarafa, Nagda", gstNumber: "23AABCK8888D1Z4", openingBalance: 9500, currentBalance: 4200, sellerId: testSeller._id, isAdmin: false },
  ];

  for (const s of sellerSuppliersData) {
    let supp = await SupplierLedger.findOne({ phone: s.phone, sellerId: testSeller._id });
    if (!supp) {
      supp = await SupplierLedger.create(s);
    } else {
      supp.currentBalance = s.currentBalance;
      await supp.save();
    }

    const txExists = await SupplierTransaction.findOne({ supplier: supp._id });
    if (!txExists) {
      await SupplierTransaction.create({
        supplier: supp._id,
        type: SupplierTransactionType.PURCHASE,
        amount: 15000,
        balanceAfter: s.currentBalance + 8000,
        description: "Bulk Purchase Goods Inward #SINV-8812",
        date: new Date(Date.now() - 8 * 24 * 3600 * 1000),
      });
      await SupplierTransaction.create({
        supplier: supp._id,
        type: SupplierTransactionType.PAYMENT,
        amount: -8000,
        balanceAfter: s.currentBalance,
        description: "UPI Supplier Settlement",
        date: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      });
    }
  }
  console.log("✓ Seeded Admin and Seller Supplier Ledgers & Transactions");

  // ==========================================
  // 7. DELIVERY STAFF SETUP
  // ==========================================
  console.log("\n--- 7. Ensuring Delivery Staff ---");
  let deliveryBoy = await Delivery.findOne({ mobile: "9111966733" });
  if (!deliveryBoy) {
    const hashedPassword = await bcrypt.hash("1234", 10);
    deliveryBoy = await Delivery.create({
      name: "Ramesh Delivery Rider",
      mobile: "9111966733",
      email: "delivery@Unnatistores.com",
      password: hashedPassword,
      address: "12, Station Road",
      city: "Nagda",
      status: "Active",
      isOnline: true,
      vehicleType: "Bike",
      vehicleNumber: "MP 13 AB 4589",
      drivingLicense: "DL1320200045678",
      balance: 1200,
      cashCollected: 4850,
      settings: { notifications: true, location: true, sound: true },
      location: {
        type: "Point",
        coordinates: [75.4321, 23.4567],
      },
    });
    console.log("✓ Created Default Delivery Boy (9111966733)");
  } else {
    deliveryBoy.status = "Active";
    deliveryBoy.isOnline = true;
    deliveryBoy.cashCollected = 4850;
    await deliveryBoy.save();
    console.log(`✓ Delivery Staff Verified: ${deliveryBoy.name} (ID: ${deliveryBoy._id})`);
  }

  // ==========================================
  // 8. ORDERS & ORDER ITEMS SEEDING
  // ==========================================
  console.log("\n--- 8. Seeding Orders across ALL 8 Statuses for Seller & Admin ---");

  const orderStatuses = [
    { status: "Pending", count: 6 },
    { status: "Received", count: 6 },
    { status: "Processed", count: 6 },
    { status: "Shipped", count: 6 },
    { status: "Out for Delivery", count: 6 },
    { status: "Delivered", count: 16 },
    { status: "Cancelled", count: 5 },
    { status: "Returned", count: 5 },
  ];

  const paymentMethods = ["UPI", "Cash on Delivery", "Credit Card", "Debit Card", "Net Banking"];
  const sellerProducts = await Product.find({ seller: testSeller._id }).limit(25);
  const poolProducts = sellerProducts.length > 0 ? sellerProducts : allProducts.slice(0, 20);

  let orderSequence = 1001;
  const createdOrders: any[] = [];
  const createdOrderItems: any[] = [];

  for (const group of orderStatuses) {
    for (let i = 0; i < group.count; i++) {
      const orderNum = `GS-${group.status.substring(0, 3).toUpperCase()}-${1000 + orderSequence}`;
      orderSequence++;

      // Pick 1-3 products for this order
      const numItems = Math.floor(Math.random() * 2) + 1;
      const selectedProds = [
        poolProducts[Math.floor(Math.random() * poolProducts.length)],
        poolProducts[Math.floor(Math.random() * poolProducts.length)],
      ].slice(0, numItems);

      const cust = adminCustomers[orderSequence % adminCustomers.length] || adminCustomers[0];
      const daysAgo = group.status === "Delivered"
        ? Math.floor(Math.random() * 45) // spread over last 45 days
        : Math.floor(Math.random() * 3); // recent (0-3 days)
      const orderDate = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);

      let subtotal = 0;
      let totalTax = 0;

      // Check if order already exists
      let order = await Order.findOne({ orderNumber: orderNum });
      if (order) {
        await OrderItem.updateMany({ order: order._id }, { $set: { seller: testSeller._id } });
        await Order.updateOne({ _id: order._id }, { $set: { adminNotes: `Demo Order - Seller: ${testSeller._id}` } });
        createdOrders.push(order);
        continue;
      }

      // Create Order first with empty items, then link
      order = new Order({
        orderNumber: orderNum,
        orderDate: orderDate,
        customer: cust._id,
        customerName: cust.name,
        customerEmail: cust.email,
        customerPhone: cust.phone,
        deliveryAddress: {
          address: cust.address || "12, Station Road",
          city: cust.city || "Nagda",
          state: "Madhya Pradesh",
          pincode: "456335",
        },
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: subtotal > 500 ? 0 : 40,
        platformFee: 5,
        discount: i % 3 === 0 ? 50 : 0,
        total: 0,
        paymentMethod: paymentMethods[orderSequence % paymentMethods.length],
        paymentStatus: group.status === "Delivered" ? "Paid" : (group.status === "Cancelled" ? "Failed" : "Pending"),
        status: group.status,
        deliveryBoy: deliveryBoy._id,
        deliveryBoyStatus: group.status === "Delivered" ? "Delivered" : (group.status === "Out for Delivery" ? "In Transit" : "Assigned"),
        trackingNumber: `TRK-${10000 + orderSequence}`,
        estimatedDeliveryDate: new Date(orderDate.getTime() + 2 * 24 * 3600 * 1000),
        deliveredAt: group.status === "Delivered" ? new Date(orderDate.getTime() + 1 * 24 * 3600 * 1000) : undefined,
        cancellationReason: group.status === "Cancelled" ? "Customer requested cancellation before dispatch" : undefined,
        adminNotes: `Demo Order - Seller: ${testSeller._id}`,
      });

      await order.save();

      const itemIds: mongoose.Types.ObjectId[] = [];
      for (const prod of selectedProds) {
        const qty = Math.floor(Math.random() * 2) + 1;
        const unitPrice = prod.price || 150;
        const itemTotal = unitPrice * qty;
        const gstRate = 5;
        const gstAmount = Math.round((itemTotal * gstRate) / 100);

        subtotal += itemTotal;
        totalTax += gstAmount;

        const orderItem = await OrderItem.create({
          order: order._id,
          product: prod._id,
          seller: testSeller._id,
          productName: prod.productName,
          productImage: prod.mainImage || (prod as any).images?.[0] || "",
          sku: prod.sku || `SKU-${prod._id.toString().slice(-4)}`,
          mrp: (prod as any).mrp || prod.discPrice || Math.round(unitPrice * 1.2),
          unitPrice: unitPrice,
          quantity: qty,
          total: itemTotal,
          hsnCode: prod.hsnCode || "1905",
          gst: gstRate,
          gstAmount: gstAmount,
          variation: "Standard Pack",
          status: group.status === "Delivered" ? "Delivered" : (group.status === "Cancelled" ? "Cancelled" : "Pending"),
        });

        itemIds.push(orderItem._id as mongoose.Types.ObjectId);
        createdOrderItems.push(orderItem);
      }

      order.items = itemIds;
      order.subtotal = subtotal;
      order.tax = totalTax;
      order.shipping = subtotal > 500 ? 0 : 40;
      order.total = subtotal + totalTax + order.shipping + order.platformFee - order.discount;
      await order.save();

      createdOrders.push(order);
    }
  }
  console.log(`✓ Seeded ${createdOrders.length} Orders with ${createdOrderItems.length} OrderItems across all statuses linked to Test Seller.`);

  // ==========================================
  // 9. RETURN & REPLACEMENT REQUESTS
  // ==========================================
  console.log("\n--- 9. Seeding Return & Replacement Requests ---");
  const returnReasons = [
    "Item seal was broken upon arrival",
    "Ordered 1kg pack but received 500g",
    "Item expired last month",
    "Product packaging damaged during transit",
    "Quality not as expected",
    "Wrong variant received",
  ];

  const returnStatuses: ("Pending" | "Approved" | "Processing" | "Completed" | "Rejected")[] = [
    "Pending", "Approved", "Processing", "Completed", "Rejected", "Pending", "Approved", "Completed",
  ];

  // Grab delivered or returned orders
  const returnCandidateOrders = createdOrders.filter(
    (o) => o.status === "Delivered" || o.status === "Returned" || o.status === "Processed"
  );

  for (let i = 0; i < Math.min(12, returnCandidateOrders.length); i++) {
    const ord = returnCandidateOrders[i];
    const orderItems = await OrderItem.find({ order: ord._id });
    if (!orderItems.length) continue;

    const targetItem = orderItems[0];
    const requestType = i % 2 === 0 ? "Return" : "Replacement";
    const status = returnStatuses[i % returnStatuses.length];

    const exists = await Return.findOne({ order: ord._id, orderItem: targetItem._id });
    if (!exists) {
      await Return.create({
        order: ord._id,
        orderItem: targetItem._id,
        customer: ord.customer,
        requestType: requestType,
        reason: returnReasons[i % returnReasons.length],
        description: `Customer requested ${requestType.toLowerCase()} via mobile app on delivery inspection.`,
        status: status,
        quantity: 1,
        images: targetItem.productImage ? [targetItem.productImage] : [],
        refundAmount: requestType === "Return" ? targetItem.total : 0,
        pickupAddress: {
          address: ord.deliveryAddress.address,
          city: ord.deliveryAddress.city,
          pincode: ord.deliveryAddress.pincode,
        },
        processedBy: admin._id,
        processedAt: status !== "Pending" ? new Date() : undefined,
      });
    }
  }
  console.log("✓ Seeded 12 Return and Replacement requests (Pending, Approved, Processing, Completed, Rejected).");

  // ==========================================
  // 10. CASH COLLECTIONS SEEDING
  // ==========================================
  console.log("\n--- 10. Seeding Delivery Cash Collections ---");
  const cashAmounts = [1250, 3400, 2150, 4800, 980, 5200, 1850, 2900, 4100, 1600];
  for (let i = 0; i < cashAmounts.length; i++) {
    const ord = createdOrders[i % createdOrders.length];
    const daysAgo = i;
    const collectedAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);

    const exists = await CashCollection.findOne({ amount: cashAmounts[i], remark: `Daily cash handover route #${i + 1}` });
    if (!exists) {
      await CashCollection.create({
        deliveryBoy: deliveryBoy._id,
        order: ord._id,
        amount: cashAmounts[i],
        remark: `Daily cash handover route #${i + 1}`,
        collectedBy: admin._id,
        collectedAt: collectedAt,
      });
    }
  }
  console.log("✓ Seeded 10 Cash Collection entries from Delivery staff to Admin.");

  // ==========================================
  // 11. INVENTORY LOSSES SEEDING
  // ==========================================
  console.log("\n--- 11. Seeding Inventory Losses for Admin & Seller ---");
  const lossReasons: ("Damaged" | "Expired" | "Missing" | "Theft" | "Broken" | "Other")[] = [
    "Damaged", "Expired", "Missing", "Theft", "Broken", "Damaged", "Expired", "Broken",
  ];

  // Admin losses
  for (let i = 0; i < 8; i++) {
    const prod = allProducts[i % allProducts.length];
    const daysAgo = i * 4;
    await InventoryLoss.create({
      product: prod._id,
      date: new Date(Date.now() - daysAgo * 24 * 3600 * 1000),
      quantity: Math.floor(Math.random() * 4) + 1,
      reason: lossReasons[i % lossReasons.length],
      weight: "Piece",
      admin: admin._id,
    });
  }

  // Seller losses
  for (let i = 0; i < 8; i++) {
    const prod = sellerProducts[i % sellerProducts.length] || allProducts[i % allProducts.length];
    const daysAgo = i * 5;
    await InventoryLoss.create({
      product: prod._id,
      date: new Date(Date.now() - daysAgo * 24 * 3600 * 1000),
      quantity: Math.floor(Math.random() * 3) + 1,
      reason: lossReasons[i % lossReasons.length],
      weight: "Piece",
      seller: testSeller._id,
    });
  }
  console.log("✓ Seeded Inventory Losses for both Admin and Seller.");

  // ==========================================
  // 12. GST REPORT ENTRIES SEEDING
  // ==========================================
  console.log("\n--- 12. Seeding GST Sales & Purchase Report Entries ---");
  const gstSuppliers = [
    { name: "Mahalaxmi Traders", gstin: "23AABCM1111A1Z1", total: 42000, s5: 15000, s12: 12000, s18: 15000 },
    { name: "Shree Balaji Wholesalers", gstin: "23AABCS2222B1Z2", total: 35000, s5: 10000, s12: 15000, s18: 10000 },
    { name: "National FMCG Distributors", gstin: "23AABCN3333C1Z3", total: 68000, s5: 20000, s12: 28000, s18: 20000 },
    { name: "Vardhman Spices & Oils", gstin: "23AABCV5555E1Z5", total: 24000, s5: 12000, s12: 6000, s18: 6000 },
    { name: "Kailash Packaging Mart", gstin: "23AABCK4444D1Z4", total: 18000, s5: 5000, s12: 5000, s18: 8000 },
  ];

  // Admin GST entries
  for (let i = 0; i < gstSuppliers.length; i++) {
    const s = gstSuppliers[i];
    const billDate = new Date(Date.now() - (i + 1) * 8 * 24 * 3600 * 1000);
    const billNo = `ADM-GST-2026-${100 + i}`;

    const exists = await GSTReportEntry.findOne({ billNo, isAdmin: true });
    if (!exists) {
      await GSTReportEntry.create({
        isAdmin: true,
        date: billDate,
        billNo: billNo,
        supplierName: s.name,
        supplierGstNumber: s.gstin,
        itemCategory: "Groceries & Staples",
        totalAmount: s.total,
        slab5Amount: s.s5,
        slab5Gst: Math.round(s.s5 * 0.05),
        slab12Amount: s.s12,
        slab12Gst: Math.round(s.s12 * 0.12),
        slab18Amount: s.s18,
        slab18Gst: Math.round(s.s18 * 0.18),
        slab28Amount: 0,
        slab28Gst: 0,
      });
    }
  }

  // Seller GST entries
  for (let i = 0; i < gstSuppliers.length; i++) {
    const s = gstSuppliers[i];
    const billDate = new Date(Date.now() - (i + 1) * 6 * 24 * 3600 * 1000);
    const billNo = `SLR-GST-2026-${200 + i}`;

    const exists = await GSTReportEntry.findOne({ billNo });
    if (!exists) {
      await GSTReportEntry.create({
        isAdmin: false,
        sellerId: testSeller._id,
        date: billDate,
        billNo: billNo,
        supplierName: s.name,
        supplierGstNumber: s.gstin,
        itemCategory: "Daily Essentials",
        totalAmount: Math.round(s.total * 0.6),
        slab5Amount: Math.round(s.s5 * 0.6),
        slab5Gst: Math.round(s.s5 * 0.6 * 0.05),
        slab12Amount: Math.round(s.s12 * 0.6),
        slab12Gst: Math.round(s.s12 * 0.6 * 0.12),
        slab18Amount: Math.round(s.s18 * 0.6),
        slab18Gst: Math.round(s.s18 * 0.6 * 0.18),
        slab28Amount: 0,
        slab28Gst: 0,
      });
    } else {
      exists.sellerId = testSeller._id;
      await exists.save();
    }
  }
  console.log("✓ Seeded GST Report entries for Admin and Seller across tax slabs.");

  // ==========================================
  // 13. SELLER WALLET & WITHDRAWAL REQUESTS
  // ==========================================
  console.log("\n--- 13. Seeding Seller Wallet & Withdrawal Requests ---");
  const walletTxData = [
    { amount: 4850, type: "Credit" as const, desc: "Order #GS-DEL-1014 Earnings Settlement", ref: "WTX-2026-001" },
    { amount: 6200, type: "Credit" as const, desc: "Order #GS-DEL-1018 Earnings Settlement", ref: "WTX-2026-002" },
    { amount: 550, type: "Debit" as const, desc: "Platform Commission deduction (5%)", ref: "WTX-2026-003" },
    { amount: 8900, type: "Credit" as const, desc: "POS Weekly Sales Batch Credit", ref: "WTX-2026-004" },
    { amount: 10000, type: "Debit" as const, desc: "Bank Account Withdrawal Payout #WR-8812", ref: "WTX-2026-005" },
    { amount: 5400, type: "Credit" as const, desc: "Order #GS-DEL-1022 Earnings Settlement", ref: "WTX-2026-006" },
    { amount: 3750, type: "Credit" as const, desc: "Order #GS-DEL-1025 Earnings Settlement", ref: "WTX-2026-007" },
    { amount: 15000, type: "Debit" as const, desc: "Bank Transfer Payout #WR-8815", ref: "WTX-2026-008" },
    { amount: 4500, type: "Credit" as const, desc: "Seller Bonus / Incentive Credit", ref: "WTX-2026-009" },
    { amount: 7200, type: "Credit" as const, desc: "Order #GS-DEL-1029 Earnings Settlement", ref: "WTX-2026-010" },
  ];

  for (let i = 0; i < walletTxData.length; i++) {
    const tx = walletTxData[i];
    const exists = await WalletTransaction.findOne({ reference: tx.ref });
    if (!exists) {
      await WalletTransaction.create({
        sellerId: testSeller._id,
        amount: tx.amount,
        type: tx.type,
        description: tx.desc,
        status: "Completed",
        reference: tx.ref,
        createdAt: new Date(Date.now() - (10 - i) * 2 * 24 * 3600 * 1000),
      });
    } else {
      exists.sellerId = testSeller._id;
      await exists.save();
    }
  }

  const withdrawRequestsData = [
    { amount: 5000, status: "Pending" as const, method: "UPI" as const, acc: "testseller@okaxis", remarks: "Weekly UPI Payout request" },
    { amount: 8500, status: "Pending" as const, method: "Bank Transfer" as const, acc: "SBI A/C: 34567890123, IFSC: SBIN0001234", remarks: "Vendor settlement payout" },
    { amount: 10000, status: "Completed" as const, method: "Bank Transfer" as const, acc: "SBI A/C: 34567890123, IFSC: SBIN0001234", remarks: "Payout processed UTR: UTR98374829102" },
    { amount: 15000, status: "Completed" as const, method: "Bank Transfer" as const, acc: "SBI A/C: 34567890123, IFSC: SBIN0001234", remarks: "Payout processed UTR: UTR98374829188" },
    { amount: 12000, status: "Approved" as const, method: "Bank Transfer" as const, acc: "SBI A/C: 34567890123, IFSC: SBIN0001234", remarks: "Approved for batch NEFT release" },
    { amount: 45000, status: "Rejected" as const, method: "Bank Transfer" as const, acc: "SBI A/C: 34567890123, IFSC: SBIN0001234", remarks: "Exceeds daily withdrawal threshold limit" },
  ];

  for (const wr of withdrawRequestsData) {
    const exists = await WithdrawRequest.findOne({ remarks: wr.remarks });
    if (!exists) {
      await WithdrawRequest.create({
        sellerId: testSeller._id,
        amount: wr.amount,
        status: wr.status,
        paymentMethod: wr.method,
        accountDetails: wr.acc,
        remarks: wr.remarks,
      });
    } else {
      exists.sellerId = testSeller._id;
      await exists.save();
    }
  }
  console.log("✓ Seeded Seller Wallet Transactions & Withdrawal Requests (Pending, Approved, Completed, Rejected).");

  // ==========================================
  // 14. POS QUOTATIONS & PURCHASE ENTRIES
  // ==========================================
  console.log("\n--- 14. Seeding POS Quotations & Purchases for Admin & Seller ---");
  const sampleItems = [
    { productName: "Aashirvaad Shudh Chakki Atta 5kg", sku: "SKU-ATTA-05", quantity: 2, unitPrice: 245, total: 490, mrp: 275 },
    { productName: "Tata Salt Vacuum Evaporated 1kg", sku: "SKU-SALT-01", quantity: 5, unitPrice: 26, total: 130, mrp: 30 },
    { productName: "Fortune Sunlite Refined Sunflower Oil 1L", sku: "SKU-OIL-01", quantity: 3, unitPrice: 145, total: 435, mrp: 165 },
    { productName: "Amul Butter Pasteurized 500g", sku: "SKU-BTR-05", quantity: 2, unitPrice: 275, total: 550, mrp: 290 },
  ];

  // Admin Quotations and Purchases
  for (let i = 1; i <= 5; i++) {
    const qEntryId = `ADM-QTN-${1000 + i}`;
    const qExists = await AdminPurchaseEntry.findOne({ admin: admin._id, entryId: qEntryId });
    if (!qExists) {
      await AdminPurchaseEntry.create({
        admin: admin._id,
        entryId: qEntryId,
        type: "quotation",
        date: new Date(Date.now() - i * 2 * 24 * 3600 * 1000).toISOString().split("T")[0],
        data: {
          billNo: qEntryId,
          type: "quotation",
          customerName: adminCustomers[i % adminCustomers.length].name,
          customerPhone: adminCustomers[i % adminCustomers.length].phone,
          items: sampleItems,
          totals: { grossAmount: 1605, discountAmount: 105, taxAmount: 75, roundOff: 0, netAmount: 1575 },
        },
      });
    }

    const pEntryId = `ADM-PUR-${2000 + i}`;
    const pExists = await AdminPurchaseEntry.findOne({ admin: admin._id, entryId: pEntryId });
    if (!pExists) {
      await AdminPurchaseEntry.create({
        admin: admin._id,
        entryId: pEntryId,
        type: "purchase",
        date: new Date(Date.now() - i * 3 * 24 * 3600 * 1000).toISOString().split("T")[0],
        data: {
          billNo: pEntryId,
          type: "purchase",
          supplier: "Mahalaxmi Traders",
          supplierGst: "23AABCM1111A1Z1",
          items: sampleItems,
          totals: { grossAmount: 1605, discountAmount: 50, taxAmount: 75, roundOff: 0, netAmount: 1630 },
        },
      });
    }
  }

  // Seller Quotations and Purchases
  for (let i = 1; i <= 5; i++) {
    const qEntryId = `SLR-QTN-${3000 + i}`;
    await SellerPurchaseEntry.findOneAndUpdate(
      { seller: testSeller._id, entryId: qEntryId },
      {
        $set: {
          seller: testSeller._id,
          entryId: qEntryId,
          type: "quotation",
          date: new Date(Date.now() - i * 2 * 24 * 3600 * 1000).toISOString().split("T")[0],
          data: {
            billNo: qEntryId,
            type: "quotation",
            customerName: sellerCustomers[i % sellerCustomers.length].name,
            customerPhone: sellerCustomers[i % sellerCustomers.length].phone,
            items: sampleItems,
            totals: { grossAmount: 1605, discountAmount: 85, taxAmount: 75, roundOff: 0, netAmount: 1595 },
          },
        }
      },
      { upsert: true, new: true }
    );

    const pEntryId = `SLR-PUR-${4000 + i}`;
    await SellerPurchaseEntry.findOneAndUpdate(
      { seller: testSeller._id, entryId: pEntryId },
      {
        $set: {
          seller: testSeller._id,
          entryId: pEntryId,
          type: "purchase",
          date: new Date(Date.now() - i * 3 * 24 * 3600 * 1000).toISOString().split("T")[0],
          data: {
            billNo: pEntryId,
            type: "purchase",
            supplier: "Nagda Local Staples Supplier",
            supplierGst: "23AABCN5555A1Z1",
            items: sampleItems,
            totals: { grossAmount: 1605, discountAmount: 60, taxAmount: 75, roundOff: 0, netAmount: 1620 },
          },
        }
      },
      { upsert: true, new: true }
    );
  }
  console.log("✓ Seeded POS Quotations and Purchase Entries for Admin and Seller.");

  // ==========================================
  // 15. COUPONS & FREE GIFT RULES
  // ==========================================
  console.log("\n--- 15. Seeding Coupons & Free Gift Rules ---");
  const couponsData = [
    { code: "WELCOME50", title: "Welcome 50% Off", desc: "50% off up to ₹150 on your first purchase", discountType: "Percentage" as const, val: 50, min: 299, max: 150 },
    { code: "FLAT100", title: "Flat ₹100 Off", desc: "Flat ₹100 discount on orders above ₹599", discountType: "Fixed" as const, val: 100, min: 599, max: 100 },
    { code: "SAVE20", title: "Super Saver 20%", desc: "Save 20% on all grocery items up to ₹200", discountType: "Percentage" as const, val: 20, min: 499, max: 200 },
    { code: "GROCERY10", title: "Grocery Special 10%", desc: "10% off on daily essentials", discountType: "Percentage" as const, val: 10, min: 399, max: 100 },
    { code: "FESTIVE25", title: "Festive Mega Deal", desc: "25% discount for festival celebrations", discountType: "Percentage" as const, val: 25, min: 799, max: 300 },
    { code: "SUMMER15", title: "Summer Cool Deal", desc: "15% discount on beverages & summer snacks", discountType: "Percentage" as const, val: 15, min: 499, max: 150 },
    { code: "DIWALI2026", title: "Grand Festive Offer", desc: "30% off up to ₹500 on festive hampers", discountType: "Percentage" as const, val: 30, min: 999, max: 500 },
    { code: "SUPERDEAL", title: "VIP Super Deal", desc: "Flat ₹250 off on carts over ₹1499", discountType: "Fixed" as const, val: 250, min: 1499, max: 250 },
  ];

  for (const cp of couponsData) {
    let coupon = await Coupon.findOne({ code: cp.code });
    if (!coupon) {
      await Coupon.create({
        code: cp.code,
        title: cp.title,
        description: cp.desc,
        discountType: cp.discountType,
        discountValue: cp.val,
        minimumPurchase: cp.min,
        maximumDiscount: cp.max,
        startDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        endDate: new Date(Date.now() + 180 * 24 * 3600 * 1000),
        isActive: true,
        status: "Published",
        userType: "All Users",
        usageLimit: 1000,
        usageCount: Math.floor(Math.random() * 85) + 12,
        usageLimitPerUser: 3,
        applicableTo: "All",
        createdBy: admin._id,
      });
    }
  }

  const freeGiftData = [
    { minCartValue: 499, ruleType: "free_gift" as const, status: "Active" as const },
    { minCartValue: 999, ruleType: "discount" as const, discountType: "percentage" as const, discountValue: 10, status: "Active" as const },
    { minCartValue: 1499, ruleType: "free_gift" as const, status: "Active" as const },
    { minCartValue: 1999, ruleType: "discount" as const, discountType: "fixed" as const, discountValue: 200, status: "Active" as const },
  ];

  for (const fg of freeGiftData) {
    const exists = await FreeGiftRule.findOne({ minCartValue: fg.minCartValue });
    if (!exists) {
      await FreeGiftRule.create(fg);
    }
  }
  console.log("✓ Seeded 8 Active Coupons and 4 Free Gift Rules.");

  // ==========================================
  // 16. ABANDONED CARTS SEEDING
  // ==========================================
  console.log("\n--- 16. Seeding Abandoned Carts with Items ---");
  for (let i = 0; i < Math.min(8, adminCustomers.length); i++) {
    const cust = adminCustomers[i];
    let cart = await Cart.findOne({ customer: cust._id });
    if (!cart) {
      cart = await Cart.create({
        customer: cust._id,
        items: [],
        total: 0,
      });
    }

    // Delete existing cart items for this cart to refresh
    await CartItem.deleteMany({ cart: cart._id });

    const p1 = allProducts[i % allProducts.length];
    const p2 = allProducts[(i + 3) % allProducts.length];

    const ci1 = await CartItem.create({
      cart: cart._id,
      product: p1._id,
      quantity: 2,
      variation: "Standard",
    });

    const ci2 = await CartItem.create({
      cart: cart._id,
      product: p2._id,
      quantity: 1,
      variation: "Pack of 1",
    });

    cart.items = [ci1._id as mongoose.Types.ObjectId, ci2._id as mongoose.Types.ObjectId];
    cart.total = (p1.price || 120) * 2 + (p2.price || 80);
    cart.updatedAt = new Date(Date.now() - (i + 1) * 1.5 * 24 * 3600 * 1000);
    await cart.save();
  }
  console.log("✓ Seeded 8 Abandoned Carts with active cart items for recovery testing.");

  // ==========================================
  // 17. FAQS & POLICIES SEEDING
  // ==========================================
  console.log("\n--- 17. Seeding FAQs & System Policies ---");
  const faqsData = [
    { question: "How can I track my order status?", answer: "You can track your order in real-time from the Orders tab in your profile or by entering your tracking number.", category: "Orders", order: 1 },
    { question: "What payment methods are supported?", answer: "We accept UPI (Google Pay, PhonePe, Paytm), Credit & Debit Cards, Net Banking, and Cash on Delivery (COD).", category: "Payments", order: 2 },
    { question: "How does 10-minute Express delivery work?", answer: "Our local dark stores and partner sellers fulfill nearby orders with prioritized dispatch within 10-15 minutes.", category: "Delivery", order: 3 },
    { question: "What is your return & replacement policy?", answer: "You can request a return or replacement within 24-48 hours of delivery for damaged, expired, or missing items.", category: "Returns", order: 4 },
    { question: "How can I become a verified seller on Unnati Stores?", answer: "Register via the Seller Sign-Up page, upload your GST/FSSAI details and store photos. Our admin team verifies accounts within 24 hours.", category: "Seller", order: 5 },
    { question: "Can I use store credit or wallet balance for checkout?", answer: "Yes, wallet credits and referral bonuses can be applied directly at the checkout payment screen.", category: "Payments", order: 6 },
    { question: "How do I print a GST Invoice for my purchase?", answer: "You can download or print official tax invoices from the Order Details page or POS Invoice Report section.", category: "Orders", order: 7 },
    { question: "What should I do if an item is missing from my delivery bag?", answer: "Click 'Request Return / Issue' under your delivered order, select 'Missing Item', and our support team will instantly refund or dispatch the item.", category: "Returns", order: 8 },
  ];

  for (const f of faqsData) {
    let faq = await FAQ.findOne({ question: f.question });
    if (!faq) {
      await FAQ.create({ ...f, status: "Active" });
    }
  }

  const customerPolicyContent = `
# Customer Terms of Service & Privacy Policy

## 1. Introduction
Welcome to Unnati Stores E-Commerce Platform. By using our website and mobile application, you agree to comply with our terms and conditions.

## 2. Order Processing & Delivery
- All orders are subject to item availability and seller acceptance.
- Estimated delivery timelines range from 10 minutes (Express) to standard same-day delivery.

## 3. Returns & Refunds
- Perishable groceries can be returned upon delivery inspection if quality is unsatisfactory.
- Packaged goods may be returned within 48 hours with original intact seal.
- Refunds are credited to the original payment method or store wallet within 2-4 business days.

## 4. Privacy & Data Protection
We respect your privacy and protect your personal information in accordance with applicable data protection laws.
`;

  const deliveryPolicyContent = `
# Delivery Partner Code of Conduct & Policies

## 1. Safety & Professionalism
- Delivery riders must wear helmets and adhere to local traffic regulations at all times.
- Maintain respectful communication with customers and merchant partners.

## 2. Cash Collection & Handover
- Cash on Delivery (COD) amounts must be deposited or handed over to the store supervisor daily.
- Discrepancies in cash collection balances must be reported immediately.

## 3. Order Verification & OTP
- Delivery must only be marked complete after collecting the customer delivery verification OTP.
`;

  const custPolicy = await Policy.findOne({ type: "customer" });
  if (!custPolicy) {
    await Policy.create({
      type: "customer",
      title: "Customer Terms of Service & Privacy Policy",
      content: customerPolicyContent,
      version: "v2.1",
      isActive: true,
    });
  }

  const delPolicy = await Policy.findOne({ type: "delivery" });
  if (!delPolicy) {
    await Policy.create({
      type: "delivery",
      title: "Delivery Partner Policy & Guidelines",
      content: deliveryPolicyContent,
      version: "v1.4",
      isActive: true,
    });
  }
  console.log("✓ Seeded FAQs, Customer Policies, and Delivery Partner Policies.");

  // ==========================================
  // 18. BRANDS, ATTRIBUTES & VARIATION TYPES
  // ==========================================
  console.log("\n--- 18. Ensuring Brands, Attributes & Variation Types ---");
  const brandNames = [
    "Amul", "Tata", "Aashirvaad", "Britannia", "Nestle", "Dabur", "Parle", "Fortune", "ITC", "Haldiram's", "Patanjali", "Cadbury",
  ];

  for (const b of brandNames) {
    const exists = await Brand.findOne({ name: b });
    if (!exists) {
      await Brand.create({ name: b });
    }
  }

  const attributeNames = ["Weight", "Size", "Pack of", "Flavour", "Color", "Packaging Type"];
  for (const a of attributeNames) {
    const exists = await Attribute.findOne({ name: a });
    if (!exists) {
      await Attribute.create({ name: a });
    }
  }

  const adminVarTypes = ["Weight Slab", "Size Options", "Pack Options"];
  for (const v of adminVarTypes) {
    const exists = await VariationType.findOne({ name: v, createdBy: "Admin" });
    if (!exists) {
      await VariationType.create({ name: v, createdBy: "Admin" });
    }
  }

  const sellerVarTypes = ["Unit Weight", "Combo Pack", "Volume Pack"];
  for (const v of sellerVarTypes) {
    const exists = await VariationType.findOne({ name: v, createdBy: "Seller" });
    if (!exists) {
      await VariationType.create({ name: v, createdBy: "Seller" });
    }
  }
  console.log("✓ Seeded Master Brands, Attributes, and Variation Types for Admin & Seller.");

  console.log("\n========================================================");
  console.log("🎉 MASTER DEMO DATA SEEDING COMPLETED SUCCESSFULLY!");
  console.log("========================================================\n");

  process.exit(0);
}

runSeed().catch((err) => {
  console.error("❌ Seeding Error:", err);
  process.exit(1);
});
