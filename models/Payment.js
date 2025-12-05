import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  providerRef: String,
  email: String,
  amount: Number,
  status: String,
  walletUpdated: { type: Boolean, default: false }, 
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Payment", paymentSchema);
