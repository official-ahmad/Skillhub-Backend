import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import { clearAdminCookieOptions } from "../config/adminCookie.js";

export default async function verifyAdmin(req, res, next) {
  const cookieToken = req.cookies?.skillhub_admin;
  const bearerToken = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearerToken || cookieToken;
  if (!token) return res.status(401).json({ error: "Admin authentication required" });

  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET, {
      issuer: "skillhub-admin",
      audience: "skillhub-admin-portal",
    });
    const admin = await Admin.findById(payload.sub).select("+passwordHash");
    if (!admin || admin.role !== "super_admin") return res.status(401).json({ error: "Invalid administrator account" });
    req.admin = admin;
    next();
  } catch {
    res.clearCookie("skillhub_admin", clearAdminCookieOptions);
    return res.status(401).json({ error: "Invalid or expired admin session" });
  }
}
