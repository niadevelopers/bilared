import express from "express";
import axios from "axios";
import crypto from "crypto";
import Payment from "../models/Payment.js";
import User from "../models/User.js";

const router = express.Router();


router.post("/initiate", async (req, res) => {
  try {
    const { amount, email } = req.body;

    if (!amount || isNaN(amount)) {
      
      return res.status(400).json({ message: "Valid amount required" });
    }

    if (!email || !email.includes("@")) {
      
      return res.status(400).json({ message: "Valid email required" });
    }

    const response = await axios.post(
     "https://api.paystack.co/transaction/initialize",
  {
    amount: Math.round(amount * 100),
    email: email.trim().toLowerCase(),
    callback_url: process.env.BASE_URL + "/api/paystack/webhook",
    metadata: { email: email.trim().toLowerCase() },
  },
  {
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  }
);


    res.json(response.data);
  } catch (err) {
    console.error("Error initializing transaction:", err.message);
    res.status(500).json({ message: "Error initializing transaction" });
  }
});


router.post("/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {

    try {
      const hash = crypto
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
        .update(req.body)
        .digest("hex");

      if (hash !== req.headers["x-paystack-signature"]) {
        return res.sendStatus(400);
      }

      const event = JSON.parse(req.body.toString());

      if (event.event === "charge.success") {
        const email =
          event.data.metadata?.email || event.data.customer?.email || null;
        const creditedAmount = event.data.amount / 100;
        const reference = event.data.reference;

        if (!email) {
          return res.sendStatus(200); 
        }

        const user = await User.findOne({ email: email.trim() });
        if (!user) {
          return res.sendStatus(200);
        }

        user.wallet.balance += creditedAmount;
        user.wallet.available += creditedAmount;
        await user.save();

        await Payment.create({
          userId: user._id,
          providerRef: reference,
          amount: creditedAmount,
          status: "success",
          createdAt: new Date(),
        });
      }

      res.sendStatus(200);
    } catch (err) {
      console.error("Webhook handler error:", err);
      res.sendStatus(500);
    }
  }
);

export default router;


