import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import UserActivityLog from "../models/UserActivityLog.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const serialize = (user) => user.toJSON();

export async function googleLogin(req, res, next) {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Google credential is required" });
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const { sub: googleId, name, email, picture, email_verified: emailVerified } = ticket.getPayload() || {};
    if (!email || !emailVerified) return res.status(401).json({ error: "A verified Google email is required" });
    const normalizedEmail = email.trim().toLowerCase();
    const prefix = normalizedEmail.split("@")[0];
    const derivedStudentId = prefix.replace(/[^a-z0-9-]/gi, "").slice(0, 80);
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(403).json({ error: "Access restricted: your account has not been added by an administrator." });
    }
    user.googleId = user.googleId || googleId;
    user.name = user.name || name || prefix;
    user.email = normalizedEmail;
    user.studentId = derivedStudentId;
    user.avatar = picture || user.avatar || "";
    await user.save();
    if (user.isSuspended) return res.status(403).json({ error: "Your account has been suspended by the administrator." });
    await UserActivityLog.create({
      user: user._id,
      action: "login",
      ipAddress: req.ip || "",
      userAgent: req.get("user-agent") || "",
      metadata: { googleVerified: true },
      actor: user.name,
    });
    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "7d", issuer: "skillhub-api", audience: "skillhub-frontend" });
    res.json({ token, user: serialize(user) });
  } catch (error) { next(error); }
}

export async function me(req, res, next) {
  try {
    const derivedStudentId = String(req.user.email || "").split("@")[0].replace(/[^a-z0-9-]/gi, "").slice(0, 80);
    if (req.user.studentId !== derivedStudentId) {
      req.user.studentId = derivedStudentId;
      await req.user.save();
    }
    res.json({ user: serialize(req.user) });
  } catch (error) { next(error); }
}

export async function updateProfile(req, res, next) {
  try {
    const prefix = String(req.user.email || "").split("@")[0];
    req.user.studentId = prefix.replace(/[^a-z0-9-]/gi, "").slice(0, 80);
    const { className } = req.body;
    if (className !== undefined) req.user.className = String(className).trim().slice(0, 120);
    await req.user.save();
    res.json({ user: serialize(req.user) });
  } catch (error) { next(error); }
}
