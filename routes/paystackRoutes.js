// routes/paystackRoutes.js
import express from "express";
import axios from "axios";
import crypto from "crypto";
import Payment from "../models/Payment.js";
import User from "../models/User.js";

const router = express.Router();

/* -----------------------------------
   1️⃣ Initialize Payment — user provides email + amount
----------------------------------- */
router.post("/initiate", async (req, res) => {
  //console.log("⚡ /api/paystack/initiate called");

  try {
    const { amount, email } = req.body;

    if (!amount || isNaN(amount)) {
      //console.log("❌ Invalid amount:", amount);
      return res.status(400).json({ message: "Valid amount required" });
    }

    if (!email || !email.includes("@")) {
      //console.log("❌ Invalid email:", email);
      return res.status(400).json({ message: "Valid email required" });
    }

    //console.log(`🧾 Initializing Paystack for ${email} — KES ${amount}`);

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


    //console.log("➡️ Paystack response received:", response.data);
    res.json(response.data);
  } catch (err) {
    console.error("❌ Error initializing transaction:", err.message);
    res.status(500).json({ message: "Error initializing transaction" });
  }
});

/* -----------------------------------
   2️⃣ Webhook Listener — update wallet
----------------------------------- */
router.post("/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
   //console.log("📩 Incoming Paystack webhook — raw body captured");

    try {
      const hash = crypto
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
        .update(req.body)
        .digest("hex");

      if (hash !== req.headers["x-paystack-signature"]) {
        //console.log("⚠️ Invalid Paystack signature — ignored");
        return res.sendStatus(400);
      }

      const event = JSON.parse(req.body.toString());
      //console.log("📩 Webhook route hit — processing...");
      //console.log("🧾 Event Type:", event.event);

      if (event.event === "charge.success") {
        // Get email from metadata (from initialize)
        const email =
          event.data.metadata?.email || event.data.customer?.email || null;
        const creditedAmount = event.data.amount / 100;
        const reference = event.data.reference;

        if (!email) {
          //console.log("⚠️ Webhook: email not found in metadata or customer");
          return res.sendStatus(200); // still acknowledge webhook
        }

        const user = await User.findOne({ email: email.trim() });
        if (!user) {
          //console.log(`⚠️ Webhook: User not found for ${email}`);
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

        //console.log(`💰 Wallet updated: ${user.email} +KES ${creditedAmount}`);
      }

      res.sendStatus(200);
    } catch (err) {
      console.error("❌ Webhook handler error:", err);
      res.sendStatus(500);
    }
  }
);

export default router;

