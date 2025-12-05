import express from "express";
import axios from "axios";
import Payment from "../models/Payment.js";
import User from "../models/User.js";

const router = express.Router();

const PESAPAL_BASE_URL = process.env.PESAPAL_BASE_URL || "https://cybqa.pesapal.com/pesapalv3"; 
const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const CALLBACK_URL = `${process.env.BASE_URL}/api/pesapal/callback`;
const IPN_URL = `${process.env.BASE_URL}/api/pesapal/ipn`;

let pesapalToken = {
    token: null,
    expiry: 0,
};

/**
 * Step 1: Request an OAuth 2.0 Bearer Token
 * This function fetches a new token if the current one is expired.
 * @returns {string} The active Bearer token.
 */
async function getPesapalToken() {
    const now = Date.now() / 1000;

    if (pesapalToken.token && pesapalToken.expiry > now + 60) {
        return pesapalToken.token;
    }

    try {
        const response = await axios.post(
            `${PESAPAL_BASE_URL}/api/Auth/RequestToken`, 
            {
                consumer_key: CONSUMER_KEY,
                consumer_secret: CONSUMER_SECRET,
            },
            {
                headers: { "Content-Type": "application/json" },
                timeout: 10000,
            }
        );

        const { token, expiryDate } = response.data;

        pesapalToken.token = token;
        pesapalToken.expiry = new Date(expiryDate).getTime() / 1000;

        console.log("New PesaPal token fetched successfully.");
        return token;
    } catch (error) {
        console.error("Failed to fetch PesaPal OAuth 2.0 Token:", error.response?.data || error.message);
        throw new Error("Could not authenticate with PesaPal API.");
    }
}

router.post("/initiate", async (req, res) => {
    try {
        const { amount, email, firstName = "User", lastName = "Unknown", phoneNumber = "" } = req.body;
        
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            return res.status(400).json({ message: "Valid amount required" });
        }
        if (!email || !email.includes("@")) {
            return res.status(400).json({ message: "Valid email required" });
        }

        const token = await getPesapalToken();
        const merchantReference = `PESA-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        const orderPayload = {
            id: merchantReference, 
            currency: "KES",
            amount: parseFloat(amount),
            description: `Deposit for ${email}`,
            callback_url: CALLBACK_URL,
            notification_id: process.env.PESAPAL_IPN_ID,
            branch: "0",
            billing_address: {
                email_address: email,
                phone_number: phoneNumber,
                first_name: firstName,
                last_name: lastName,
                country: "KE",
            },
        };

        const pesapalRes = await axios.post(
            `${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`,
            orderPayload,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                timeout: 15000,
            }
        );

        const { order_tracking_id, redirect_url } = pesapalRes.data;

        if (!redirect_url) {
            console.error("Pesapal API error - Missing redirect URL:", pesapalRes.data);
            return res.status(500).json({ message: "Failed to get PesaPal checkout URL" });
        }

        await Payment.create({
            providerRef: merchantReference,
            trackingId: order_tracking_id, 
            amount: parseFloat(amount),
            status: "pending",
            email,
        });

        res.json({ checkoutUrl: redirect_url });

    } catch (err) {
        console.error("PesaPal initiate error:", err.response?.data || err.message || err);
        res.status(500).json({ 
            message: "Error initializing payment", 
            detail: err.response?.data?.error || err.message 
        });
    }
});


router.get("/callback", async (req, res) => {
    const { OrderTrackingId } = req.query;

   
    res.send(`
        <html>
        <head>
            <title>Payment Status</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family:sans-serif; text-align:center; padding:50px; background-color: #f4f7f6;">
            <div style="max-width:400px; margin:0 auto; padding: 20px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); background-color: white;">
                <h1 style="color: #10b981;">Payment Processed</h1>
                <p><strong>Tracking ID:</strong> ${OrderTrackingId || "N/A"}</p>
                <p style="color: #374151;">We have received notification of your payment transaction.</p>
                <p style="font-size: 0.9em; color: #6b7280;">Your wallet will be updated shortly after the payment is verified (via our secure Webhook/IPN).</p>
                <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; border: none; border-radius: 6px; background-color: #3b82f6; color: white; cursor: pointer;">Close Window</button>
            </div>
        </body>
        </html>
    `);

 
});

/**
 * Helper function to check transaction status and update database.
 * @param {string} trackingId PesaPal's Order Tracking ID.
 */
async function checkAndUpdateStatus(trackingId) {
    if (!trackingId) return;

    try {
        const token = await getPesapalToken();

        const statusUrl = `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?OrderTrackingId=${trackingId}`;

        const statusRes = await axios.get(statusUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            timeout: 10000,
        });

        const { payment_status, merchant_reference } = statusRes.data;
        const normalizedStatus = payment_status.toUpperCase();
        
        console.log(`PesaPal Status Check (${trackingId}):`, normalizedStatus);
        
        const payment = await Payment.findOne({ providerRef: merchant_reference });
        if (!payment) return console.warn(`Payment record not found for reference: ${merchant_reference}`);
        
        if (normalizedStatus === "COMPLETED" && payment.status !== "success") {
            const user = await User.findOne({ email: payment.email });
            if (user) {
                user.wallet.balance += payment.amount;
                user.wallet.available += payment.amount;
                await user.save();
                console.log(`User ${user.email} wallet updated with ${payment.amount}`);
            }

            payment.status = "success";
            payment.pesapalTrackingId = trackingId; 
            payment.completionDate = new Date();
            await payment.save();
            
            console.log(`Payment ${payment.providerRef} marked as success.`);

        } else if (normalizedStatus === "FAILED" || normalizedStatus === "CANCELLED") {
            payment.status = normalizedStatus.toLowerCase();
            await payment.save();
            console.log(`Payment ${payment.providerRef} marked as ${payment.status}.`);
        }

    } catch (err) {
        console.error("Pesapal status check error:", err.response?.data || err.message);
    }
}


router.get("/ipn", async (req, res) => {
    const { OrderTrackingId, Status, MerchantReference } = req.query;

    if (!OrderTrackingId) {
        return res.status(400).send("Invalid request: Missing OrderTrackingId");
    }

    await checkAndUpdateStatus(OrderTrackingId);

    
    res.status(200).send(OrderTrackingId);
});

export default router;
