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
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    cluster.fork();
  });
} else {
  connectDB();
  const app = express();

  app.post(
    "/api/pesapal/webhook",
    express.raw({ type: "*/*" }),
    (req, res, next) => {
      req.rawBody = req.body;
      next();
    },
    paystackRoutes
  );

  app.use(cors());
  app.use(express.json());
  app.use(bodyParser.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(express.static(__dirname));

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/pesapal", paystackRoutes);
  app.use("/api/wallet", walletRoutes);
  app.use("/api/game", gameRoutes);
  app.use("/api/admin", adminRoutes);

  app.get("/api", (req, res) => {
    res.send(`Skill Game Backend Running (Worker ${process.pid})`);
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
  });
}

