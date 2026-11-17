import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const serialize = (user) => user.toJSON();

export async function googleLogin(req, res, next) {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Google credential is required" });
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const { sub: googleId, name, email, picture, email_verified: emailVerified } = ticket.getPayload() || {};
    if (!email || !emailVerified) return res.status(401).json({ error: "A verified Google email is required" });
    if (!email.toLowerCase().endsWith("@students.au.edu.pk")) return res.status(403).json({ error: "Only official Air University student emails (@students.au.edu.pk) are allowed." });
    const prefix = email.split("@")[0];
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { googleId, name: name || prefix, email: email.toLowerCase(), avatar: picture || "" }, $setOnInsert: { studentId: prefix } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "7d", issuer: "skillhub-api", audience: "skillhub-frontend" });
    res.json({ token, user: serialize(user) });
  } catch (error) { next(error); }
}

export function me(req, res) { res.json({ user: serialize(req.user) }); }

export async function updateProfile(req, res, next) {
  try {
    const { studentId, className } = req.body;
    if (studentId !== undefined) req.user.studentId = String(studentId).trim().slice(0, 80);
    if (className !== undefined) req.user.className = String(className).trim().slice(0, 120);
    await req.user.save();
    res.json({ user: serialize(req.user) });
  } catch (error) { next(error); }
}
