import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../backend/.env') });

const OrderSchema = new mongoose.Schema({}, { strict: false });
const DeliverySchema = new mongoose.Schema({}, { strict: false });

const Order = mongoose.model('Order', OrderSchema);
const Delivery = mongoose.model('Delivery', DeliverySchema);

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/unnati');
    console.log('Connected to DB');

    const order = await Order.findById('6abceeabc7cfc3bdae402249');
    console.log('Order:', JSON.stringify(order, null, 2));

    const deliveryPartners = await Delivery.find({});
    console.log('Delivery Partners:', JSON.stringify(deliveryPartners.map(d => ({
        id: d._id,
        name: d.name,
        city: d.city,
        status: d.status,
        isOnline: d.isOnline,
        location: d.location
    })), null, 2));

    await mongoose.disconnect();
}

run().catch(console.error);
