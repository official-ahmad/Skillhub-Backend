import { Router } from "express";
import auth from "../middleware/auth.js";
import { googleLogin, me, updateProfile } from "../controllers/authController.js";
const router = Router();
router.post("/google", googleLogin);
router.get("/me", auth, me);
router.patch("/profile", auth, updateProfile);
export default router;
