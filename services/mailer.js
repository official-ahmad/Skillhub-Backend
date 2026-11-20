import nodemailer from "nodemailer";

const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_FROM);

export async function sendWelcomeEmail({ name, email, accountType }) {
  if (!smtpConfigured()) {
    console.info(`Welcome email skipped for ${email}: SMTP_HOST, SMTP_PORT, and SMTP_FROM are not configured.`);
    return { status: "skipped", message: "SMTP is not configured" };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    ...(process.env.SMTP_USER && process.env.SMTP_PASS
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
      : {}),
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Your Skillhub account is ready",
      text: `Hello ${name},\n\nAn administrator created a Skillhub ${accountType} account for this email address. Sign in to Skillhub with Google using ${email}. No separate password is used.\n\nSkillhub`,
      html: `<p>Hello ${escapeHtml(name)},</p><p>An administrator created a Skillhub ${escapeHtml(accountType)} account for this email address. Sign in to Skillhub with Google using <strong>${escapeHtml(email)}</strong>. No separate password is used.</p><p>Skillhub</p>`,
    });
    return { status: "sent", message: "Welcome email sent" };
  } catch (error) {
    console.error(`Welcome email failed for ${email}:`, error.message);
    return { status: "failed", message: "Account created, but the welcome email could not be sent" };
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
