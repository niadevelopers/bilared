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
        
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: "Valid amount required" });
        }
        
        if (!phoneNumber || !/^(\+?254|0)[17]\d{8}$/.test(phoneNumber)) {
            return res.status(400).json({ 
                message: "Valid Kenyan phone number required. Supported formats: +2547xxxxxxxx, 2547xxxxxxxx, 07xxxxxxxx, +2541xxxxxxxx, 2541xxxxxxxx, 01xxxxxxxx (for newer prefixes starting with 1 or 7)" 
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const reference = `PESA-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        // Standardize to 254xxxxxxxxx (full international format without +)
        let msisdn = phoneNumber.replace(/^\+/, '').replace(/\s/g, '');
        if (msisdn.startsWith('0')) {
            msisdn = '254' + msisdn.slice(1);
        } else if (!msisdn.startsWith('254')) {
            msisdn = '254' + msisdn;  // fallback, but regex should prevent invalid
        }

        // ─── IMPORTANT CHANGE ───────────────────────────────────────────────
        // Use MERCHANT email for PesaFlux API call
        // User email is kept only for internal wallet update
        const merchantEmail = process.env.PESAFUX_MERCHANT_EMAIL;

        if (!merchantEmail) {
            console.error("PESAFUX_MERCHANT_EMAIL is not set in environment variables");
            return res.status(500).json({ 
                message: "Server configuration error - payment gateway not properly set up" 
            });
        }

        const payload = {
            api_key: PESAFUX_API_KEY,
            email: merchantEmail,                    // ← FIXED: PesaFlux registered email
            amount: parseFloat(amount),
            msisdn: msisdn,
            reference: reference,                    // your internal reference
        };

        // Optional: log what is actually sent (without exposing api_key)
        console.log("PesaFlux STK payload:", { 
            email: merchantEmail, 
            amount: amount, 
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

        if (data.ResultCode !== "200" && data.ResultCode !== 0 && data.ResponseCode !== 0) {
            console.error("PesaFlux STK initiation failed:", data);
            return res.status(400).json({ 
                message: "Failed to send M-Pesa prompt", 
                detail: data.ResultDesc || data.ResponseDescription || data.message || "Unknown error" 
            });
        }

        const trackingId = data.TransactionID || data.CheckoutRequestID || reference;

        // Store the USER'S email in the Payment record (for wallet update later)
        await Payment.create({
            providerRef: reference,
            trackingId: trackingId,
            amount: parseFloat(amount),
            status: "pending",
            email: email,                    // ← User's email → used for findByEmail wallet update
            userId: user._id,
            phone: msisdn,
        });

        res.json({ 
            success: true,
            message: "M-Pesa prompt sent — check your phone and enter PIN",
            reference,
            trackingId,
            checkoutUrl: null   // no redirect
        });

    } catch (err) {
        console.error("PesaFlux initiate error:", err.response?.data || err.message || err);
        res.status(500).json({ 
            message: "Error initializing payment", 
            detail: err.response?.data?.ResultDesc || 
                    err.response?.data?.ResponseDescription || 
                    err.response?.data?.message || 
                    err.message 
        });
    }
});


//  GET /callback
//  Minimal page → auto-reload homepage on success flow
//  (shows briefly if user is redirected here, then refreshes main window)
// ────────────────────────────────────────────────
router.get("/callback", async (req, res) => {
    const { reference, trackingId } = req.query;

    // Optional: could query status, but webhook should have handled it

    res.send(`
        <html>
        <head>
            <title>Payment Received</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script>
                // Try to refresh opener (if popup) or self, then close
                setTimeout(() => {
                    if (window.opener && !window.opener.closed) {
                        window.opener.location.reload();    // refresh homepage
                    } else {
                        window.location.reload();           // or refresh self if same tab
                    }
                    setTimeout(() => window.close(), 800); // close this tab/window
                }, 3000); // give 3 seconds to read message
            </script>
        </head>
        <body style="font-family:sans-serif; text-align:center; padding:50px; background-color: #f4f7f6;">
            <div style="max-width:400px; margin:0 auto; padding: 20px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); background-color: white;">
                <h1 style="color: #10b981;">Payment Received!</h1>
                <p style="color: #374151;">Your wallet is being updated...</p>
                <p style="font-size: 0.9em; color: #6b7280;">Reference: ${reference || trackingId || "N/A"}<br>Refreshing homepage shortly...</p>
                <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; border: none; border-radius: 6px; background-color: #3b82f6; color: white; cursor: pointer;">Close</button>
            </div>
        </body>
        </html>
    `);
});

// ────────────────────────────────────────────────
//  POST /ipn  → Webhook from PesaFlux (real-time success/failure)
//  Always respond 200 quickly
// ────────────────────────────────────────────────
router.post("/ipn", async (req, res) => {
    try {
        const payload = req.body;
        console.log("PesaFlux webhook:", payload);

        if (!payload || typeof payload !== 'object') {
            return res.status(200).json({ received: true });
        }

        // Common fields from similar aggregators (adjust if your actual payload differs)
        const responseCode = payload.ResponseCode ?? payload.ResultCode;
        const reference = payload.reference || payload.MerchantRequestID || payload.CheckoutRequestID;
        const transactionId = payload.TransactionID || payload.CheckoutRequestID;
        const amountStr = payload.TransactionAmount || payload.amount;
        const statusDesc = payload.ResponseDescription || payload.ResultDesc || payload.TransactionStatus || "";

        if (!reference) {
            console.warn("Webhook missing reference");
            return res.status(200).json({ received: true });
        }

        const payment = await Payment.findOne({ 
            providerRef: reference, 
            status: { $ne: 'success' } 
        });

        if (!payment) {
            console.log(`No pending payment found for ref: ${reference}`);
            return res.status(200).json({ received: true });
        }

        // Update tracking ID if available
        if (transactionId && payment.trackingId === payment.providerRef) {
            payment.trackingId = transactionId;
        }

        const isSuccess = responseCode === 0 || 
                         statusDesc.toLowerCase().includes("success") || 
                         statusDesc.toLowerCase().includes("completed");

        if (isSuccess) {
            const user = await User.findOne({ email: payment.email });
            
            if (user) {
                const amountToAdd = parseFloat(amountStr) || payment.amount;

                user.wallet.balance += amountToAdd;
                user.wallet.available += amountToAdd; 
                await user.save();

                payment.status = "success";
                payment.completionDate = new Date();
                await payment.save();

                console.log(`Success: Wallet +${amountToAdd} KES for ${payment.email}`);
            } else {
                payment.status = "review_user_missing";
                await payment.save();
                console.error(`User not found: ${payment.email}`);
            }
        } else {
            // Failed / cancelled / timed out
            payment.status = "failed";
            await payment.save();
            console.log(`Payment failed for ref: ${reference} — ${statusDesc}`);
        }

        res.status(200).json({ received: true });

    } catch (err) {
        console.error("Webhook error:", err);
        res.status(200).json({ received: true }); // never block retries
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

