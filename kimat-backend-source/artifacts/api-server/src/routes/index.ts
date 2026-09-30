import { Router, type IRouter } from "express";
import healthRouter from "./health";
import valuationRouter from "./valuation";

const router: IRouter = Router();

router.use(healthRouter);
router.use(valuationRouter);

export default router;
