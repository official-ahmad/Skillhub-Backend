import { Router } from "express";
import auth from "../middleware/auth.js";
import Query from "../models/Query.js";

const router = Router();

router.post("/", auth, async (req, res, next) => {
  try {
    const message = String(req.body.message || "").trim();
    if (!message) return res.status(400).json({ error: "Message is required" });
    const query = await Query.create({ userId: req.user.id, message });
    res.status(201).json(query);
  } catch (error) { next(error); }
});

router.get("/notifications", auth, async (req, res, next) => {
  try {
    const queries = await Query.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json(queries);
  } catch (error) { next(error); }
});

export default router;
