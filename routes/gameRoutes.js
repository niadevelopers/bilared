import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import GameSession from "../models/GameSession.js";
import User from "../models/User.js";
import crypto from "crypto";

const router = express.Router();

// Start new round
router.post("/start", protect, async (req, res) => {
  const { stake } = req.body;
  const user = await User.findById(req.user._id);
  if (stake < 10 || stake > 100000)
    return res.status(400).json({ message: "Stake out of range" });
  if (user.wallet.available < stake)
    return res.status(400).json({ message: "Insufficient funds" });

  user.wallet.available -= stake;
  await user.save();

  const sessionToken = crypto.randomBytes(16).toString("hex");

  const session = await GameSession.create({
    userId: user._id,
    stake,
    sessionToken,
    startTime: new Date(),
  });

  res.json({ sessionToken, sessionId: session._id });
});

// Submit result
router.post("/result", protect, async (req, res) => {
  const { sessionId, result } = req.body;
  const session = await GameSession.findById(sessionId);
  const user = await User.findById(req.user._id);

  if (!session || session.userId !== user._id.toString())
    return res.status(400).json({ message: "Invalid session" });

  if (result === "win") {
    const profit = (104 / 100) * session.stake;
    const payout = session.stake + profit;
    user.wallet.balance += payout;
    user.wallet.available += payout;
    session.result = "win";
    session.payout = payout;
  } else {
    session.result = "lose";
    session.payout = 0;
  }

  session.endTime = new Date();
  await session.save();
  await user.save();

  res.json({ message: "Round processed", wallet: user.wallet, session });
});

export default router;
