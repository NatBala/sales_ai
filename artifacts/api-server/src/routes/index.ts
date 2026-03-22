import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import leadsRouter from "./leads";
import meetingsRouter from "./meetings";
import agentsRouter from "./agents";
import realtimeRouter from "./realtime";
import voiceRouter from "./voice";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(leadsRouter);
router.use(meetingsRouter);
router.use(agentsRouter);
router.use(realtimeRouter);
router.use(voiceRouter);

export default router;
