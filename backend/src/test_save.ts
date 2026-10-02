import mongoose from "mongoose";
import Product from "./models/Product";

const MONGODB_URI = "mongodb+srv://allokfarms_db_user:RSWTY1kVcvGeOtje@cluster1.moyfuna.mongodb.net/Unnati-ecom?retryWrites=true&w=majority&appName=Cluster1";

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully!");

    const product = await Product.findOne({ productName: /test product/i });
    if (!product) {
      console.log("No product named 'test product' found!");
      return;
    }

    console.log("Before update:", {
      id: product._id,
      productName: product.productName,
      isEnquiryOnly: product.isEnquiryOnly,
      taxPreference: product.taxPreference,
    });

    product.isEnquiryOnly = true;
    product.taxPreference = "excluded";
    await product.save();

    const updated = await Product.findById(product._id);
    console.log("After update:", {
      id: updated?._id,
      productName: updated?.productName,
      isEnquiryOnly: updated?.isEnquiryOnly,
      taxPreference: updated?.taxPreference,
    });

  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
