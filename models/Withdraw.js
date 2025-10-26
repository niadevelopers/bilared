import mongoose from "mongoose";

const withdrawSchema = new mongoose.Schema({
  userId: String,
  gameId: String,
  contact: {
    name: String,
    email: String,
    phone: String,
  },
  amountRequested: Number,
  status: { type: String, default: "pending" },
  adminNotes: String,
  paidReference: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Withdraw", withdrawSchema);
