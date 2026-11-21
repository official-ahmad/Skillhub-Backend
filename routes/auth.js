import { Router } from "express";
import auth from "../middleware/auth.js";
import { googleLogin, me, updateProfile } from "../controllers/authController.js";
const router = Router();
router.post("/google", googleLogin);
router.get("/me", auth, me);
router.patch("/profile", auth, updateProfile);
router.post("/logout", auth, async (req, res, next) => {
  try {
    const { default: UserActivityLog } = await import("../models/UserActivityLog.js");
    await UserActivityLog.create({ user: req.user._id, action: "logout", ipAddress: req.ip || "", userAgent: req.get("user-agent") || "", actor: req.user.name });
    res.json({ loggedOut: true });
  } catch (error) { next(error); }
});
export default router;
