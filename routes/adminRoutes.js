import express from "express";
import Withdraw from "../models/Withdraw.js";
import User from "../models/User.js";

const router = express.Router();

router.get("/withdraws", async (req, res) => {
  const pending = await Withdraw.find({ status: "pending" });
  res.json(pending);
});

router.post("/withdraws/:id/mark-paid", async (req, res) => {
  const { providerRef } = req.body;
  const withdraw = await Withdraw.findById(req.params.id);
  if (!withdraw) return res.status(404).json({ message: "Not found" });
  const user = await User.findById(withdraw.userId);
  user.wallet.balance -= withdraw.amountRequested;
  user.wallet.locked -= withdraw.amountRequested;
  await user.save();
  withdraw.status = "paid";
  withdraw.paidReference = providerRef;
  await withdraw.save();
  res.json({ message: "Withdraw marked as paid" });
});

router.post("/withdraws/:id/reject", async (req, res) => {
  const withdraw = await Withdraw.findById(req.params.id);
  if (!withdraw) return res.status(404).json({ message: "Not found" });
  const user = await User.findById(withdraw.userId);
  user.wallet.available += withdraw.amountRequested;
  user.wallet.locked -= withdraw.amountRequested;
  await user.save();
  withdraw.status = "rejected";
  await withdraw.save();
  res.json({ message: "Withdraw rejected" });
});

export default router;
