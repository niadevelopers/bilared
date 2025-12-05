import express from "express";
import axios from "axios";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
// Mongoose is imported but session logic is removed to avoid Replica Set error.
import mongoose from "mongoose"; 

const router = express.Router();

const PESAPAL_BASE_URL = process.env.PESAPAL_BASE_URL || "https://cybqa.pesapal.com/pesapalv3";
const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const BASE_URL = process.env.BASE_URL; 
const CALLBACK_URL = `${BASE_URL}/api/pesapal/callback`;
const IPN_URL = `${BASE_URL}/api/pesapal/ipn`; 

let pesapalToken = {
    token: null,
    expiry: 0,
};


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
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
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
                first_name: user.firstName || firstName,
                last_name: user.lastName || lastName,
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
            userId: user._id, 
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

    if (OrderTrackingId) {
        await checkAndUpdateStatus(OrderTrackingId);
    }

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
                <p style="font-size: 0.9em; color: #6b7280;">Your wallet will be updated shortly after verification.</p>
                <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; border: none; border-radius: 6px; background-color: #3b82f6; color: white; cursor: pointer;">Close Window</button>
            </div>
        </body>
        </html>
    `);
});

router.get("/ipn", async (req, res) => {
    const { OrderTrackingId } = req.query;

    if (!OrderTrackingId) {
        return res.status(400).send("Invalid request: Missing OrderTrackingId");
    }
    
    await checkAndUpdateStatus(OrderTrackingId);

    res.status(200).send(OrderTrackingId); 
});


/**
 * Helper function to check transaction status and update database (Non-Atomic).
 * NOTE: This is a fast solution that removes MongoDB transaction safety.
 * This also checks for 'Completed' or 'Success' in the status string.
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
        
        const { payment_status_description, merchant_reference } = statusRes.data;
        
        const payment_status = payment_status_description; 
        
        if (!payment_status || typeof payment_status !== 'string') {
            return console.warn(`PesaPal Status Check failed: Invalid or missing status. Data:`, statusRes.data);
        }

        const normalizedStatus = payment_status.toUpperCase();
        
        
        const payment = await Payment.findOne({ 
            providerRef: merchant_reference, 
            status: { $ne: 'success' } 
        }); 
        
        if (!payment) {
            return console.warn(`Payment record not found or already processed for reference: ${merchant_reference}`);
        }
        

        if (normalizedStatus.includes("COMPLETED") || normalizedStatus.includes("SUCCESS")) {
            const user = await User.findOne({ email: payment.email }); 
            
            if (user) {
                const amountToAdd = parseFloat(payment.amount);

                user.wallet.balance += amountToAdd;
                user.wallet.available += amountToAdd; 
                await user.save(); 
                

                payment.status = "success";
                payment.pesapalTrackingId = trackingId; 
                payment.completionDate = new Date();
                await payment.save(); 
                
            } else {
                console.error(`User not found for email: ${payment.email}. Cannot update wallet.`);
                payment.status = "review_user_missing"; 
                await payment.save();
            }

        } else if (normalizedStatus.includes("FAILED") || normalizedStatus.includes("CANCELLED") || normalizedStatus.includes("REVERSED")) {
            payment.status = normalizedStatus.toLowerCase();
            await payment.save();

        }

    } catch (err) {
        console.error("Pesapal status check/update error:", err.response?.data || err.message);
    }
}


export default router;
