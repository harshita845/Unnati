import mongoose from 'mongoose';

const MONGO_URI = "mongodb+srv://allokfarms_db_user:RSWTY1kVcvGeOtje@cluster1.moyfuna.mongodb.net/Unnati-ecom?retryWrites=true&w=majority&appName=Cluster1";

async function run() {
  await mongoose.connect(MONGO_URI);
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));

  const result = await Product.updateOne(
    { productName: 'CAPITAL BULBUL KHUTI RS20' },
    {
      $set: {
        storageLocation: {
          city: 'Delhi',
          warehouse: 'Main Hub',
          room: 'Room A',
          rackNumber: 'Rack-03'
        },
        rackNumber: 'Rack-03'
      }
    }
  );

  console.log('Update result:', result);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
