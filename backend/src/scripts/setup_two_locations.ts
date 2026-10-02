import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const SellerSchema = new mongoose.Schema({}, { strict: false });
const DeliverySchema = new mongoose.Schema({}, { strict: false });
const StorageLocationSchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });

const Seller = mongoose.model('Seller', SellerSchema);
const Delivery = mongoose.model('Delivery', DeliverySchema);
const StorageLocation = mongoose.model('StorageLocation', StorageLocationSchema);
const Product = mongoose.model('Product', ProductSchema);

async function setupTwoLocations() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/unnati');
    console.log('Connected to MongoDB');

    // ----------------------------------------------------
    // 1. SETUP SELLERS (Indore & Hyderabad ONLY)
    // ----------------------------------------------------
    console.log('Cleaning and setting up Sellers...');
    
    // Indore Store (Test Location)
    const indoreSellerData = {
        sellerName: 'Indore Test Seller',
        storeName: 'Unnati Indore Store (Test)',
        email: 'indore.seller@unnatistores.com',
        mobile: '9111966732',
        category: 'Grocery',
        address: 'Palasia, Indore, Madhya Pradesh',
        city: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '452001',
        latitude: '22.7244',
        longitude: '75.8839',
        location: {
            type: 'Point',
            coordinates: [75.8839, 22.7244]
        },
        serviceRadiusKm: 15,
        status: 'Approved',
        isEnabled: true
    };

    // Hyderabad Store (Live Location)
    const hyderabadSellerData = {
        sellerName: 'Hyderabad Live Seller',
        storeName: 'Unnati Hyderabad Store (Live)',
        email: 'hyderabad.seller@unnatistores.com',
        mobile: '9111966735',
        category: 'Grocery',
        address: 'Road No 12, Banjara Hills, Hyderabad, Telangana',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500034',
        latitude: '17.4156',
        longitude: '78.4347',
        location: {
            type: 'Point',
            coordinates: [78.4347, 17.4156]
        },
        serviceRadiusKm: 15,
        status: 'Approved',
        isEnabled: true
    };

    // Update main test seller to Indore
    const indoreSeller = await Seller.findOneAndUpdate(
        { _id: '6abcb6bf965ee483c9296a24' },
        { $set: indoreSellerData },
        { upsert: true, new: true }
    );

    // Upsert Hyderabad Seller
    const hyderabadSeller = await Seller.findOneAndUpdate(
        { mobile: '9111966735' },
        { $set: hyderabadSellerData },
        { upsert: true, new: true }
    );

    // Remove any extra sellers outside Indore and Hyderabad
    const validSellerIds = [indoreSeller._id, hyderabadSeller._id];
    const deleteExtraSellers = await Seller.deleteMany({ _id: { $nin: validSellerIds } });
    console.log(`Kept 2 Sellers (${indoreSeller.get("storeName")}, ${hyderabadSeller.get("storeName")}). Deleted ${deleteExtraSellers.deletedCount} extra seller(s).`);


    // ----------------------------------------------------
    // 2. SETUP DELIVERY PARTNERS (Indore & Hyderabad ONLY)
    // ----------------------------------------------------
    console.log('Cleaning and setting up Delivery Partners...');

    // Indore Delivery Partner
    const indoreDeliveryData = {
        name: 'Indore Test Delivery',
        mobile: '9111966733',
        email: 'delivery.indore@unnatistores.com',
        address: 'Palasia, Indore, Madhya Pradesh',
        city: 'Indore',
        pincode: '452001',
        status: 'Active',
        isOnline: true,
        vehicleType: 'Two Wheeler',
        location: {
            type: 'Point',
            coordinates: [75.8839, 22.7244]
        }
    };

    // Hyderabad Delivery Partner
    const hyderabadDeliveryData = {
        name: 'Hyderabad Live Delivery',
        mobile: '9111966734',
        email: 'delivery.hyderabad@unnatistores.com',
        address: 'Banjara Hills, Hyderabad, Telangana',
        city: 'Hyderabad',
        pincode: '500034',
        status: 'Active',
        isOnline: true,
        vehicleType: 'Two Wheeler',
        location: {
            type: 'Point',
            coordinates: [78.4347, 17.4156]
        }
    };

    const indoreDelivery = await Delivery.findOneAndUpdate(
        { _id: '6abcb6bf965ee483c9296a2f' },
        { $set: indoreDeliveryData },
        { upsert: true, new: true }
    );

    const hyderabadDelivery = await Delivery.findOneAndUpdate(
        { $or: [{ mobile: '9111966734' }, { email: 'delivery.hyderabad@unnatistores.com' }] },
        { $set: hyderabadDeliveryData },
        { upsert: true, new: true }
    );

    const validDeliveryIds = [indoreDelivery._id, hyderabadDelivery._id];
    const deleteExtraDelivery = await Delivery.deleteMany({ _id: { $nin: validDeliveryIds } });
    console.log(`Kept 2 Delivery Partners (${indoreDelivery.get("name")}, ${hyderabadDelivery.get("name")}). Deleted ${deleteExtraDelivery.deletedCount} extra partner(s).`);


    // ----------------------------------------------------
    // 3. SETUP STORAGE LOCATIONS (Indore & Hyderabad ONLY)
    // ----------------------------------------------------
    console.log('Cleaning Storage Locations...');
    await StorageLocation.deleteMany({}); // Delete all demo locations (Mumbai, Bangalore, Delhi)

    const newStorageLocations = [
        // Indore Storage Locations
        { level: 'city', name: 'Indore', city: 'Indore', warehouse: '', room: '', rackNumber: '', isActive: true, createdBy: 'Admin' },
        { level: 'warehouse', name: 'Palasia Central Warehouse (IND-01)', city: 'Indore', warehouse: 'Palasia Central Warehouse (IND-01)', room: '', rackNumber: '', isActive: true, createdBy: 'Admin' },
        { level: 'room', name: 'Room 101 (Grocery)', city: 'Indore', warehouse: 'Palasia Central Warehouse (IND-01)', room: 'Room 101 (Grocery)', rackNumber: '', isActive: true, createdBy: 'Admin' },
        { level: 'rack', name: 'Rack A1', city: 'Indore', warehouse: 'Palasia Central Warehouse (IND-01)', room: 'Room 101 (Grocery)', rackNumber: 'Rack A1', isActive: true, createdBy: 'Admin' },
        { level: 'rack', name: 'Rack A2', city: 'Indore', warehouse: 'Palasia Central Warehouse (IND-01)', room: 'Room 101 (Grocery)', rackNumber: 'Rack A2', isActive: true, createdBy: 'Admin' },

        // Hyderabad Storage Locations
        { level: 'city', name: 'Hyderabad', city: 'Hyderabad', warehouse: '', room: '', rackNumber: '', isActive: true, createdBy: 'Admin' },
        { level: 'warehouse', name: 'Banjara Hills Warehouse (HYD-01)', city: 'Hyderabad', warehouse: 'Banjara Hills Warehouse (HYD-01)', room: '', rackNumber: '', isActive: true, createdBy: 'Admin' },
        { level: 'room', name: 'Room H1 (Main)', city: 'Hyderabad', warehouse: 'Banjara Hills Warehouse (HYD-01)', room: 'Room H1 (Main)', rackNumber: '', isActive: true, createdBy: 'Admin' },
        { level: 'rack', name: 'Rack H1-A', city: 'Hyderabad', warehouse: 'Banjara Hills Warehouse (HYD-01)', room: 'Room H1 (Main)', rackNumber: 'Rack H1-A', isActive: true, createdBy: 'Admin' },
        { level: 'rack', name: 'Rack H1-B', city: 'Hyderabad', warehouse: 'Banjara Hills Warehouse (HYD-01)', room: 'Room H1 (Main)', rackNumber: 'Rack H1-B', isActive: true, createdBy: 'Admin' }
    ];

    await StorageLocation.insertMany(newStorageLocations);
    console.log('Inserted Storage Locations for Indore and Hyderabad ONLY.');


    // ----------------------------------------------------
    // 4. ASSIGN PRODUCTS TO STORES
    // ----------------------------------------------------
    console.log('Updating Product Store Assignments...');
    // Ensure all products are assigned to valid active seller (Indore Store)
    await Product.updateMany(
        { $or: [{ seller: { $exists: false } }, { seller: null }, { seller: { $nin: validSellerIds } }] },
        { $set: { seller: indoreSeller._id } }
    );
    console.log('All products mapped to valid active store.');

    await mongoose.disconnect();
    console.log('--- SETUP COMPLETE: 2 Stores & 2 Delivery Boys Ready ---');
}

setupTwoLocations().catch(console.error);
