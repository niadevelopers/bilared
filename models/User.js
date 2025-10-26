import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  gameId: { type: String, unique: true },
  username: String,
  email: String,
  password: String,
  wallet: {
    balance: { type: Number, default: 0 },
    locked: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
