import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// CORS must come first — before helmet — so headers are always sent, even on errors
const corsOptions: cors.CorsOptions = {
  origin: true, // reflects request origin (works for any origin)
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  exposedHeaders: ["Content-Disposition"],
  maxAge: 86400,
};

app.use(cors(corsOptions));
// Explicit preflight handler for all routes
app.options("*", cors(corsOptions));

// Other middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan("dev"));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "Server is running." });
});

// API routes
app.use("/api", routes);

// Error handler (must be last)
app.use(errorHandler);

export default app;
