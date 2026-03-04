import express from "express";
import axios from "axios";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import mongoose from "mongoose"; 

const router = express.Router();

const PESAFUX_BASE_URL = "https://api.pesaflux.co.ke";
const PESAFUX_API_KEY = process.env.PESAFUX_API_KEY;   // ← Required in .env
const BASE_URL = process.env.BASE_URL; 
const CALLBACK_URL = `${BASE_URL}/api/pesapal/callback`;   // kept but minimally used
const WEBHOOK_URL = `${BASE_URL}/api/pesapal/ipn`;         // set this in PesaFlux dashboard


// ────────────────────────────────────────────────
//  POST /initiate
//  Triggers STK Push → no redirect
// ────────────────────────────────────────────────
router.post("/initiate", async (req, res) => {
    try {
        const { amount, email, phoneNumber, firstName = "User", lastName = "Unknown" } = req.body;

        // ─── Input validation ───────────────────────────────────────────────
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: "Valid amount required (greater than 0)" });
        }

        if (!phoneNumber || !/^(\+?254|0)[17]\d{8}$/.test(phoneNumber)) {
            return res.status(400).json({
                message: "Valid Kenyan phone number required. Supported formats: +2547xxxxxxxx, 2547xxxxxxxx, 07xxxxxxxx, +2541xxxxxxxx, 2541xxxxxxxx, 01xxxxxxxx"
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found with this email" });
        }

        // Generate unique reference
        const reference = `PESA-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

        // Normalize phone to international format: 2547xxxxxxxx or 2541xxxxxxxx
        let msisdn = phoneNumber
            .replace(/^\+/, '')
            .replace(/\s/g, '')
            .replace(/-/g, '');

        if (msisdn.startsWith('0')) {
            msisdn = '254' + msisdn.slice(1);
        } else if (!msisdn.startsWith('254')) {
            msisdn = '254' + msisdn;
        }

        // ─── Use MERCHANT email for PesaFlux (not the user's email) ────────
        const merchantEmail = process.env.PESAFUX_MERCHANT_EMAIL;

        if (!merchantEmail) {
            console.error("Critical: PESAFUX_MERCHANT_EMAIL is not set in environment variables");
            return res.status(500).json({
                message: "Payment gateway configuration error. Please contact support."
            });
        }

        const payload = {
            api_key: PESAFUX_API_KEY,
            email: merchantEmail,                    // ← PesaFlux registered merchant email
            amount: parseFloat(amount),
            msisdn: msisdn,
            reference: reference
        };

        // Debug log (safe – api_key hidden)
        console.log("[PesaFlux STK Request]", {
            merchantEmail,
            amount: payload.amount,
            msisdn,
            reference
        });

        const response = await axios.post(
            `${PESAFUX_BASE_URL}/v1/initiatestk`,
            payload,
            {
                headers: { "Content-Type": "application/json" },
                timeout: 15000,
            }
        );

        const data = response.data;

        // ─── Improved success detection ────────────────────────────────────
        const responseCode = data.ResponseCode ?? data.ResultCode ?? null;
        const description = (data.ResultDesc || data.ResponseDescription || data.message || "").toLowerCase();

        const isSuccess =
            responseCode === 0 ||
            responseCode === "200" ||
            description.includes("enter your mpesa pin") ||
            description.includes("request accepted") ||
            description.includes("successfully") ||
            description.includes("processing") ||
            description.includes("prompt sent");

        if (!isSuccess) {
            console.error("[PesaFlux STK FAILED]", data);
            return res.status(400).json({
                message: "Failed to send M-Pesa prompt",
                detail: description || "Unknown gateway error",
                fullResponse: data // helpful for debugging (remove in production if sensitive)
            });
        }

        // Success – extract best available tracking/reference ID
        const trackingId =
            data.TransactionID ||
            data.CheckoutRequestID ||
            data.MerchantRequestID ||
            data.TransactionReference ||
            reference;

        // Store USER email in Payment record (for wallet lookup later)
        await Payment.create({
            providerRef: reference,
            trackingId,
            amount: parseFloat(amount),
            status: "pending",
            email,                               // ← user's email
            userId: user._id,
            phone: msisdn,
            initiatedAt: new Date()
        });

        // ─── Response to frontend ──────────────────────────────────────────
        res.json({
            success: true,
            message: "M-Pesa prompt sent successfully — check your phone and enter PIN",
            reference,
            trackingId,
            checkoutUrl: null,
            amount: parseFloat(amount)
        });

    } catch (err) {
        console.error("[PesaFlux initiate error]", {
            message: err.message,
            response: err.response?.data,
            status: err.response?.status
        });

        const detail =
            err.response?.data?.ResultDesc ||
            err.response?.data?.ResponseDescription ||
            err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Internal server error";

        res.status(500).json({
            message: "Error initializing payment",
            detail
        });
    }
});

// GET /callback - Fallback page (rarely used in pure STK Push)
router.get("/callback", async (req, res) => {
    const { reference, trackingId, status } = req.query; // allow optional ?status=success/fail for manual calls

    let title = "Payment Status";
    let message = "We have received your payment notification.";
    let color = "#10b981"; // green

    if (status === "failed") {
        title = "Payment Issue";
        message = "There was a problem processing your payment. Please check your phone or try again.";
        color = "#ef4444"; // red
    }

    res.send(`
        <html>
        <head>
            <title>${title}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script>
                setTimeout(() => {
                    if (window.opener && !window.opener.closed) {
                        window.opener.location.reload(true); // force reload homepage
                        setTimeout(() => window.close(), 500);
                    } else {
                        // No opener → refresh self or show message
                        document.getElementById('status').innerHTML = 
                            '<p style="color:#10b981;">Payment processed! Refresh your main page to see updated balance.</p>' +
                            '<button onclick="window.location.reload()">Refresh Now</button>';
                    }
                }, 3500); // slightly longer delay for readability
            </script>
        </head>
        <body style="font-family:sans-serif; text-align:center; padding:60px; background-color:#f9fafb;">
            <div style="max-width:420px; margin:0 auto; padding:30px; border-radius:16px; box-shadow:0 6px 20px rgba(0,0,0,0.12); background:white;">
                <h1 style="color:${color};">${title}</h1>
                <p style="color:#374151; font-size:1.1em;">${message}</p>
                <p style="font-size:0.95em; color:#6b7280; margin:20px 0;">
                    Reference: ${reference || trackingId || "N/A"}<br>
                    Your wallet should update shortly — you can close this window.
                </p>
                <div id="status"></div>
                <button onclick="window.close()" style="margin-top:24px; padding:12px 28px; border:none; border-radius:8px; background:#3b82f6; color:white; font-weight:bold; cursor:pointer;">
                    Close Window
                </button>
            </div>
        </body>
        </html>
    `);
});

router.post("/ipn", async (req, res) => {
    try {
        const payload = req.body || {};

        // HEAVY LOGGING - paste these logs after next test
        console.log("[WEBHOOK FULL PAYLOAD]", JSON.stringify(payload, null, 2));
        console.log("[WEBHOOK KEYS]", Object.keys(payload));

        // Extract reference - try multiple possible names from similar APIs
        const reference = 
            payload.reference ||
            payload.TransactionReference ||
            payload.MerchantRequestID ||
            payload.CheckoutRequestID ||
            null;

        console.log("[WEBHOOK] Detected reference:", reference);

        if (!reference) {
            console.warn("[WEBHOOK] No reference found in payload");
            return res.status(200).json({ received: true });
        }

        // Find the pending payment using the stored reference
        const payment = await Payment.findOne({
            providerRef: reference,
            status: { $ne: "success" }
        });

        if (!payment) {
            console.warn(`[WEBHOOK] No matching pending payment for reference: ${reference}`);
            return res.status(200).json({ received: true });
        }

        console.log(`[WEBHOOK] Matched payment → user email in waiting: ${payment.email}, amount: ${payment.amount}`);

        // Status check
        const responseCode = payload.ResponseCode ?? payload.ResultCode ?? -1;
        const desc = (payload.ResponseDescription || payload.ResultDesc || "").toLowerCase();

        const isSuccess = responseCode === 0 || desc.includes("success") || desc.includes("accepted");

        if (isSuccess) {
            // Use the "waiting" email stored in Payment
            const user = await User.findOne({ email: payment.email });

            if (user) {
                const amountToAdd = parseFloat(payload.TransactionAmount || payload.amount) || payment.amount;

                user.wallet.balance += amountToAdd;
                user.wallet.available += amountToAdd;
                await user.save();

                payment.status = "success";
                payment.completionDate = new Date();
                payment.finalAmount = amountToAdd; // optional
                await payment.save();

                console.log(`[WEBHOOK SUCCESS] Wallet updated +${amountToAdd} KES for user: ${payment.email}`);
            } else {
                payment.status = "failed_user_not_found";
                await payment.save();
                console.error(`[WEBHOOK] User not found for email: ${payment.email}`);
            }
        } else {
            payment.status = "failed";
            payment.failureReason = desc || "Unknown failure";
            await payment.save();
            console.log(`[WEBHOOK] Transaction failed: ${desc}`);
        }

        res.status(200).json({ received: true });

    } catch (err) {
        console.error("[WEBHOOK CRASH]", err.message, err.stack);
        res.status(200).json({ received: true });
    }
});


// Optional helper (can be called from frontend polling if you want real-time status without relying 100% on webhook)
async function checkAndUpdateStatus(reference) {
    if (!reference) return;

    try {
        const res = await axios.post(
            `${PESAFUX_BASE_URL}/v1/transactionstatus`,
            { api_key: PESAFUX_API_KEY, reference },
            { headers: { "Content-Type": "application/json" }, timeout: 10000 }
        );

        const data = res.data;
        const responseCode = data.ResponseCode ?? data.ResultCode;
        const statusDesc = data.ResponseDescription || data.ResultDesc || "";

        const payment = await Payment.findOne({ providerRef: reference, status: { $ne: 'success' } });
        if (!payment) return;

        if (responseCode === 0 || statusDesc.toLowerCase().includes("success")) {
            // same success logic as webhook...
            const user = await User.findOne({ email: payment.email });
            
            if (user) {
                const amountToAdd = parseFloat(data.TransactionAmount || data.amount) || payment.amount;

                user.wallet.balance += amountToAdd;
                user.wallet.available += amountToAdd; 
                await user.save();

                payment.status = "success";
                payment.completionDate = new Date();
                await payment.save();
            }
        } else if (responseCode !== undefined) {
            payment.status = "failed";
            await payment.save();
        }

    } catch (err) {
        console.error("Status poll failed:", err.message);
    }
}

export default router;




