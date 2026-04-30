import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import connectDB from "./config/db";
import { backfillUserIds } from "./utils/backfillUserIds";
import { registerCronJobs } from "./utils/cronJobs";

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await backfillUserIds().catch((e) => console.error("[backfill] failed:", e));
  await registerCronJobs().catch((e) => console.error("[cron] register failed:", e));
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start();
