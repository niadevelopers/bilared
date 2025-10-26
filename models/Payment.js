import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  userId: String,
  providerRef: String,
  amount: Number,
  status: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Payment", paymentSchema);
