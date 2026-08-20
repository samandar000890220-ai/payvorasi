import { Router, type IRouter } from "express";
import healthRouter from "./health";
import voiceRouter from "./voice";
import documentsRouter from "./documents";
import templatesRouter from "./templates";
import knowledgeRouter from "./knowledge";
import projectsRouter from "./projects";
import agentsRouter from "./agents";
import aiChatRouter from "./aiChat";
import supportRouter from "./support";
import billingRouter from "./billing";
import apiKeysRouter from "./apiKeys";
import integrationsRouter from "./integrations";
import accountRouter from "./account";

const router: IRouter = Router();

router.use(healthRouter);
router.use(voiceRouter);
router.use(documentsRouter);
router.use(templatesRouter);
router.use(knowledgeRouter);
router.use(projectsRouter);
router.use(agentsRouter);
router.use(aiChatRouter);
router.use(supportRouter);
router.use(billingRouter);
router.use(apiKeysRouter);
router.use(integrationsRouter);
router.use(accountRouter);

export default router;
