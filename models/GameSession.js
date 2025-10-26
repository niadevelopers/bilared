import mongoose from "mongoose";

const gameSessionSchema = new mongoose.Schema({
  userId: String,
  stake: Number,
  sessionToken: String,
  startTime: Date,
  endTime: Date,
  result: String,
  payout: Number,
});

export default mongoose.model("GameSession", gameSessionSchema);
