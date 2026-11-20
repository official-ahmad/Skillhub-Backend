import { Router } from "express";
import Technology from "../models/Technology.js";

const router = Router();
router.get("/", async (_req, res, next) => {
  try { res.json(await Technology.find().sort({ category: 1, name: 1 }).lean()); }
  catch (error) { next(error); }
});

export default router;
