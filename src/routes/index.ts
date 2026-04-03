import { Router } from "express";
import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import projectRoutes from "./projectRoutes";
import timesheetRoutes from "./timesheetRoutes";
import timerRoutes from "./timerRoutes";
import reportRoutes from "./reportRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/projects", projectRoutes);
router.use("/timesheets", timesheetRoutes);
router.use("/timers", timerRoutes);
router.use("/reports", reportRoutes);

export default router;
