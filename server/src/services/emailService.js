const nodemailer = require("nodemailer");

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendPasswordResetEmail({ to, resetUrl, firstName }) {
  const safeName = firstName || "Bonjour";
  const subject = "Réinitialisation de votre mot de passe — Maroc Résidences";
  const text = [
    `Bonjour ${safeName},`,
    "",
    "Vous avez demandé la réinitialisation de votre mot de passe.",
    `Cliquez sur ce lien pour en choisir un nouveau : ${resetUrl}`,
    "",
    "Ce lien expire dans 1 heure.",
    "",
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:560px">
      <p>Bonjour ${safeName},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;background:#2f4f3f;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p style="font-size:14px;color:#64748b">Ce lien expire dans 1 heure.</p>
      <p style="font-size:14px;color:#64748b">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
    </div>
  `;

  if (!isEmailConfigured()) {
    console.log("[EMAIL] SMTP non configuré — lien de réinitialisation généré :");
    console.log(`[EMAIL] Destinataire: ${to}`);
    console.log(`[EMAIL] Lien: ${resetUrl}`);
    return;
  }

  const transporter = createTransporter();
  const from =
    process.env.SMTP_FROM || `"Maroc Résidences" <${process.env.SMTP_USER}>`;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

module.exports = {
  sendPasswordResetEmail,
};
