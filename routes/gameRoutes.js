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

router.post("/result", protect, async (req, res) => {
  const { sessionId, result } = req.body;
  const session = await GameSession.findById(sessionId);
  const user = await User.findById(req.user._id);

  if (!session || session.userId !== user._id.toString())
    return res.status(400).json({ message: "Invalid session" });

  const stake = session.stake;
  let houseFee = 0;

  if (result === "win") {
    let profitPercent;
    if (stake <= 100) profitPercent = 70;
    else if (stake <= 1000) profitPercent = 65;
    else if (stake <= 10000) profitPercent = 60;
    else profitPercent = 45;

    const profit = (profitPercent / 100) * stake;

    // House keeps 30% of the profit
    houseFee = 0.30 * profit;

    const payout = stake + profit - houseFee; 
    user.wallet.balance += payout;
    user.wallet.available += payout;

    session.result = "win";
    session.payout = payout;
    session.houseFee = houseFee; 
  } else {
    
    houseFee = 0.05 * stake;

    session.result = "lose";
    session.payout = -houseFee; 

    user.wallet.balance -= houseFee;
    user.wallet.available -= houseFee;
  }

  session.endTime = new Date();
  await session.save();
  await user.save();

  res.json({ message: "Round processed", wallet: user.wallet, session });
});

export default router;
