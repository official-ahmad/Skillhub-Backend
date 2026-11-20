const secure = process.env.NODE_ENV === "production";

export const adminCookieOptions = {
  httpOnly: true,
  secure,
  sameSite: secure ? "none" : "lax",
  maxAge: 2 * 60 * 60 * 1000,
  path: "/",
};

export const clearAdminCookieOptions = {
  httpOnly: adminCookieOptions.httpOnly,
  secure: adminCookieOptions.secure,
  sameSite: adminCookieOptions.sameSite,
  path: adminCookieOptions.path,
};
