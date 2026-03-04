import express from "express";
import axios from "axios";
import Payment from "../models/Payment.js";
import User from "../models/User.js";

const router = express.Router();

const PESAFUX_BASE_URL = "https://api.pesaflux.co.ke";
const PESAFUX_API_KEY = process.env.PESAFUX_API_KEY;
const PESAFUX_MERCHANT_EMAIL = process.env.PESAFUX_MERCHANT_EMAIL; // required
const BASE_URL = process.env.BASE_URL || "https://yourdomain.com";
const CALLBACK_URL = `${BASE_URL}/api/pesapal/callback`; // legacy/minimal
const WEBHOOK_URL = `${BASE_URL}/api/pesapal/ipn`;       // must be set in dashboard

// Validate critical env vars at startup (do this once in app.js ideally)
if (!PESAFUX_API_KEY || !PESAFUX_MERCHANT_EMAIL) {
  console.error("Missing PesaFlux credentials in .env → payments disabled");
}

// ────────────────────────────────────────────────
// POST /initiate - Trigger STK Push (no redirect)
// ────────────────────────────────────────────────
router.post("/initiate", async (req, res) => {
  try {
    const { amount, email, phoneNumber } = req.body;

    // Validation
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: "Valid amount > 0 required" });
    }

    if (!phoneNumber || !/^(\+?254|0)[17]\d{8}$/.test(phoneNumber)) {
      return res.status(400).json({
        message: "Valid Kenyan phone required (e.g. 2547xxxxxxxx or 07xxxxxxxx)"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const reference = `PESA-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    // Normalize phone → 254xxxxxxxxx
    let msisdn = phoneNumber.replace(/^\+/, "").replace(/\s|-/g, "");
    if (msisdn.startsWith("0")) msisdn = "254" + msisdn.slice(1);
    else if (!msisdn.startsWith("254")) msisdn = "254" + msisdn;

    if (!PESAFUX_MERCHANT_EMAIL) {
      console.error("PESAFUX_MERCHANT_EMAIL missing");
      return res.status(500).json({ message: "Gateway configuration error" });
    }

    const payload = {
      api_key: PESAFUX_API_KEY,
      email: PESAFUX_MERCHANT_EMAIL, // merchant only
      amount: parseFloat(amount),
      msisdn,
      reference,
    };

    console.log("[PesaFlux STK Request]", { amount, msisdn, reference });

    const response = await axios.post(
      `${PESAFUX_BASE_URL}/v1/initiatestk`,
      payload,
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );

    const data = response.data;

    // Official success indicators
    const isSuccess =
      data.success === "200" ||
      (data.ResultCode ?? data.ResponseCode ?? -1) === 0 ||
      (data.massage || data.ResultDesc || data.ResponseDescription || "")
        .toLowerCase()
        .includes("request sent sucessfully") ||
      (data.massage || data.ResultDesc || data.ResponseDescription || "")
        .toLowerCase()
        .includes("enter your mpesa pin");

    if (!isSuccess) {
      console.error("[PesaFlux STK Failed]", data);
      return res.status(400).json({
        message: "Failed to initiate STK",
        detail: data.massage || data.ResultDesc || "Unknown error",
      });
    }

    const trackingId =
      data.transaction_request_id ||
      data.CheckoutRequestID ||
      data.TransactionID ||
      reference;

    await Payment.create({
      providerRef: reference,
      trackingId,
      amount: parseFloat(amount),
      status: "pending",
      email, // user email – used later for wallet
      userId: user._id,
      phone: msisdn,
      initiatedAt: new Date(),
    });

    res.json({
      success: true,
      message: "M-Pesa prompt sent – check your phone & enter PIN",
      reference,
      trackingId,
      checkoutUrl: null,
      amount: parseFloat(amount),
    });
  } catch (err) {
    console.error("[Initiate Error]", err.response?.data || err.message);
    res.status(500).json({
      message: "Payment initiation failed",
      detail: err.response?.data?.ResultDesc || err.message,
    });
  }
});

// ────────────────────────────────────────────────
// GET /callback – Legacy fallback (rarely used in STK)
// ────────────────────────────────────────────────
router.get("/callback", (req, res) => {
  const { reference, trackingId, status } = req.query;

  let title = "Payment Status";
  let message = "Transaction processed. Refresh your page to see updates.";
  let color = "#10b981";

  if (status === "failed") {
    title = "Payment Failed";
    message = "Could not complete payment. Try again or contact support.";
    color = "#ef4444";
  }

  res.send(`
    <html>
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script>
        setTimeout(() => {
          if (window.opener && !window.opener.closed) {
            window.opener.location.reload(true);
            setTimeout(() => window.close(), 600);
          } else {
            document.body.innerHTML += '<p style="color:#10b981; margin-top:30px;">Payment likely processed – refresh main page.</p>';
          }
        }, 4000);
      </script>
    </head>
    <body style="font-family:sans-serif; text-align:center; padding:80px; background:#f9fafb;">
      <div style="max-width:420px; margin:auto; padding:30px; border-radius:16px; background:white; box-shadow:0 8px 24px rgba(0,0,0,0.1);">
        <h1 style="color:${color};">${title}</h1>
        <p style="font-size:1.1em; color:#374151;">${message}</p>
        <p style="color:#6b7280; margin:20px 0;">Ref: ${reference || trackingId || "N/A"}</p>
        <button onclick="window.close()" style="padding:12px 32px; background:#3b82f6; color:white; border:none; border-radius:8px; cursor:pointer;">
          Close
        </button>
      </div>
    </body>
    </html>
  `);
});

// ────────────────────────────────────────────────
// POST /ipn – Webhook from PesaFlux (critical)
// ────────────────────────────────────────────────
router.post("/ipn", async (req, res) => {
  try {
    const payload = req.body || {};

    console.log("[WEBHOOK RECEIVED]", JSON.stringify(payload, null, 2));

    const reference =
      payload.TransactionReference ||
      payload.reference ||
      payload.MerchantRequestID ||
      payload.CheckoutRequestID ||
      null;

    if (!reference) {
      console.warn("[WEBHOOK] No reference in payload");
      return res.status(200).json({ received: true });
    }

    const payment = await Payment.findOne({
      providerRef: reference,
      status: { $ne: "success" },
    });

    if (!payment) {
      console.warn(`[WEBHOOK] No pending payment for ref: ${reference}`);
      return res.status(200).json({ received: true });
    }

    console.log(`[WEBHOOK MATCH] Ref: ${reference} | User email: ${payment.email} | Amount: ${payment.amount}`);

    const responseCode = payload.ResponseCode ?? -1;
    const desc = (payload.ResponseDescription || "").toLowerCase();
    const isSuccess = responseCode === 0 || desc.includes("success") || desc.includes("accepted");

    if (isSuccess) {
      const user = await User.findOne({ email: payment.email });

      if (user) {
        const amountToAdd = parseFloat(payload.TransactionAmount) || payment.amount;
        user.wallet.balance += amountToAdd;
        user.wallet.available += amountToAdd;
        await user.save();

        payment.status = "success";
        payment.completionDate = new Date();
        payment.finalAmount = amountToAdd;
        await payment.save();

        console.log(`[WEBHOOK SUCCESS] +${amountToAdd} KES → ${payment.email}`);
      } else {
        payment.status = "failed_user_not_found";
        await payment.save();
        console.error(`[WEBHOOK] User missing: ${payment.email}`);
      }
    } else {
      payment.status = "failed";
      payment.failureReason = desc || payload.ResponseDescription || "Unknown";
      await payment.save();
      console.log(`[WEBHOOK FAIL] Ref ${reference} – ${desc}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("[WEBHOOK ERROR]", err);
    res.status(200).json({ received: true });
  }
});

// ────────────────────────────────────────────────
// Helper: Poll status (frontend can call if needed)
// ────────────────────────────────────────────────
async function checkAndUpdateStatus(reference) {
  if (!reference) return;

  try {
    const { data } = await axios.post(
      `${PESAFUX_BASE_URL}/v1/transactionstatus`,
      { api_key: PESAFUX_API_KEY, reference },
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    const responseCode = data.ResponseCode ?? -1;
    const desc = (data.ResponseDescription || "").toLowerCase();

    const payment = await Payment.findOne({
      providerRef: reference,
      status: { $ne: "success" },
    });

    if (!payment) return;

    if (responseCode === 0 || desc.includes("success")) {
      const user = await User.findOne({ email: payment.email });
      if (user) {
        const amountToAdd = parseFloat(data.TransactionAmount) || payment.amount;
        user.wallet.balance += amountToAdd;
        user.wallet.available += amountToAdd;
        await user.save();

        payment.status = "success";
        payment.completionDate = new Date();
        await payment.save();
      }
    } else if (responseCode !== -1) {
      payment.status = "failed";
      await payment.save();
    }
  } catch (err) {
    console.error("[STATUS POLL ERROR]", err.message);
  }
}

export default router;
