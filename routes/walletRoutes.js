import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/User.js";
import Withdraw from "../models/Withdraw.js";

const router = express.Router();

router.get("/balance", protect, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Not authorized" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const wallet = user.wallet || { balance: 0, available: 0, locked: 0 };
    res.json({
      balance: Number(wallet.balance),
      available: Number(wallet.available),
      locked: Number(wallet.locked),
    });
  } catch (err) {
    console.error("Wallet fetch error:", err);
    res.status(500).json({ message: "Server error", balance: 0, available: 0, locked: 0 });
  }
});

router.post("/withdraw", protect, async (req, res) => {
  const { name, email, phone } = req.body;
  const user = await User.findById(req.user._id);
  const withdrawable = user.wallet.available;

  if (withdrawable <= 0) return res.status(400).json({ message: "No available funds" });

  user.wallet.locked += withdrawable;
  user.wallet.available = 0;
  await user.save();

  const request = await Withdraw.create({
    userId: user._id,
    gameId: user.gameId,
    contact: { name, email, phone },
    amountRequested: withdrawable,
  });

  res.json({
    message: "Withdraw request submitted",
    wallet: user.wallet,
    request,
  });
});

export default router;

