import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import departmentsRouter from "./departments";
import employeesRouter from "./employees";
import usersRouter from "./users";
import missionsRouter from "./missions";
import dashboardRouter from "./dashboard";
import importRouter from "./import";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(departmentsRouter);
router.use(employeesRouter);
router.use(usersRouter);
router.use(missionsRouter);
router.use(dashboardRouter);
router.use(importRouter);

export default router;
