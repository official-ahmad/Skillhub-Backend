import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Cache-Control", "public, max-age=3600");

  const rawUrl = req.query.url;
  if (typeof rawUrl !== "string" || !rawUrl.trim())
    return res.status(400).json({ error: "A valid image URL is required" });

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: "The image URL is malformed" });
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:")
    return res.status(400).json({ error: "Only HTTP and HTTPS image URLs are allowed" });

  try {
    const upstream = await fetch(rawUrl);
    if (!upstream.ok)
      return res.status(502).json({ error: "The upstream image could not be fetched" });

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const imageBuffer = Buffer.from(await upstream.arrayBuffer());
    res.set("Content-Type", contentType);
    return res.status(200).send(imageBuffer);
  } catch {
    return res.status(500).json({ error: "The avatar proxy could not complete the request" });
  }
});

export default router;
