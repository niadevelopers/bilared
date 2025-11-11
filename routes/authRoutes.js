import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fetch from "node-fetch"; 
import User from "../models/User.js";

const router = express.Router();
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY; 

async function verifyTurnstile(token, ip) {
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
    });
    const data = await response.json();
    return data.success;
  } catch (err) {
    console.error("Turnstile verification failed:", err);
    return false;
  }
}

router.post("/register", async (req, res) => {
  const { username, email, password, "cf-turnstile-response": token } = req.body;

  const valid = await verifyTurnstile(token, req.ip);
  if (!valid) return res.status(400).json({ message: "Bot verification failed. Please try again." });

  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ message: "Email already exists" });

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username,
    email,
    password: hash,
    gameId: "G" + Date.now(),
  });
  res.json(user);
});

router.post("/login", async (req, res) => {
  const { email, password, "cf-turnstile-response": token } = req.body;

  const valid = await verifyTurnstile(token, req.ip);
  if (!valid) return res.status(400).json({ message: "Bot verification failed. Please try again." });

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Invalid credentials" });

  const tokenJwt = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ token: tokenJwt, user });
});

export default router;
