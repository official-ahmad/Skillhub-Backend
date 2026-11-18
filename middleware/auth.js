import jwt from "jsonwebtoken";
import User from "../models/User.js";

export default async function auth(req, res, next) {
  const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: "Account no longer exists" });
    if (user.isSuspended) return res.status(403).json({ error: "Your account has been suspended by the administrator." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
