import { Router } from "express";
import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import projectRoutes from "./projectRoutes";
import timesheetRoutes from "./timesheetRoutes";
import timerRoutes from "./timerRoutes";
import reportRoutes from "./reportRoutes";
import attendanceRoutes from "./attendanceRoutes";
import leaveRoutes from "./leaveRoutes";
import documentRoutes from "./documentRoutes";
import employeeProfileRoutes from "./employeeProfileRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/projects", projectRoutes);
router.use("/timesheets", timesheetRoutes);
router.use("/timers", timerRoutes);
router.use("/reports", reportRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/leaves", leaveRoutes);
router.use("/documents", documentRoutes);
router.use("/employee-profile", employeeProfileRoutes);

export default router;
