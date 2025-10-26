import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import paystackRoutes from "./routes/paystackRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import gameRoutes from "./routes/gameRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import cluster from "cluster";
import os from "os";
//const path = require("path");//added

dotenv.config();

if (cluster.isPrimary) {
  // 🧩 Master Process — forks one worker per CPU core
  const numCPUs = os.cpus().length;
  console.log(`⚙️ Master ${process.pid} is running`);
  console.log(`🚀 Starting ${numCPUs} worker processes...`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Optional: Restart crashed workers automatically
  cluster.on("exit", (worker, code, signal) => {
    console.log(`❌ Worker ${worker.process.pid} crashed. Restarting...`);
    cluster.fork();
  });
} else {
  // 🧩 Worker Processes — actual Express servers
  connectDB();
  const app = express();

  console.log(`🟢 Worker ${process.pid} starting Express server...`);

  /* -----------------------------------
     ✅ 1️⃣  Paystack webhook (must come BEFORE JSON parsers)
  ----------------------------------- */
  app.post(
    "/api/paystack/webhook",
    express.raw({ type: "*/*" }),
    (req, res, next) => {
      console.log("📩 Incoming Paystack webhook — raw body captured");
      req.rawBody = req.body;
      next();
    },
    paystackRoutes
  );

  /* -----------------------------------
     ✅ 2️⃣  Normal middleware for all other routes
  ----------------------------------- */
  app.use(cors());
  app.use(express.json());
  app.use(bodyParser.json());
  app.use(express.urlencoded({ extended: true }));


  // Serve all static files (HTML, CSS, JS, images, etc.) from the same directory
app.use(express.static(__dirname));

// Always serve index.html for any other routes (for SPAs or direct links)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

  /* -----------------------------------
     ✅ 3️⃣  Mount API routes
  ----------------------------------- */
  app.use("/api/auth", authRoutes);
  app.use("/api/paystack", paystackRoutes);
  app.use("/api/wallet", walletRoutes);
  app.use("/api/game", gameRoutes);
  app.use("/api/admin", adminRoutes);

  /* -----------------------------------
     ✅ 4️⃣  Root route
  ----------------------------------- */
  app.get("/", (req, res) => {
    console.log(`✅ Root route hit by worker ${process.pid}`);
    res.send(`Skill Game Backend Running (Worker ${process.pid})`);
  });

  /* -----------------------------------
     ✅ 5️⃣  Start Server
  ----------------------------------- */
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Worker ${process.pid} running on port ${PORT}`);
  });
}


