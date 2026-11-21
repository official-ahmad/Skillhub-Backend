import { Router } from "express";
import Announcement from "../models/Announcement.js";

const router = Router();

router.get("/active", async (_req, res, next) => {
  try {
    const announcement = await Announcement.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean();
    res.json({ announcement });
  } catch (error) { next(error); }
});

export default router;
