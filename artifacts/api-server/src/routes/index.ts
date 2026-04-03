import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import platformsRouter from "./platforms";
import servicesRouter from "./services";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";
import adminRouter from "./admin";
import telegramRouter from "./telegram";
import path from "path";
import express from "express";

const router: IRouter = Router();

router.use("/healthz", healthRouter);
router.use("/auth", authRouter);
router.use("/platforms", platformsRouter);
router.use("/services", servicesRouter);
router.use("/orders", ordersRouter);
router.use("/payments", paymentsRouter);
router.use("/users", usersRouter);
router.use("/dashboard", dashboardRouter);
router.use("/admin", adminRouter);
router.use("/telegram", telegramRouter);

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
router.use("/uploads", express.static(UPLOADS_DIR));

export default router;
