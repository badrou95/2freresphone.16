// nodemailer is lazy-loaded only when SMTP credentials are configured.

export interface LowStockEmailPayload {
  recipientEmail: string;
  storeName: string;
  productName: string;
  productSku: string;
  currentStock: number;
  thresholdUsed: number;
}

export interface EmailDispatchResult {
  status: 'sent' | 'not_configured' | 'failed';
  error?: string;
}

export async function sendLowStockAlertEmail(
  payload: LowStockEmailPayload,
): Promise<EmailDispatchResult> {
  const subject = `[${payload.storeName}] Alerte stock faible — ${payload.productName} (${payload.currentStock} restant${payload.currentStock > 1 ? 's' : ''})`;
  const textBody = [
    `Alerte de stock faible sur ${payload.storeName}`,
    '',
    `Produit : ${payload.productName}`,
    `SKU : ${payload.productSku}`,
    `Stock actuel : ${payload.currentStock} unité(s)`,
    `Seuil configuré : ${payload.thresholdUsed} unité(s)`,
    '',
    `Connectez-vous au panneau administrateur (/admin) pour réapprovisionner cet article.`,
  ].join('\n');

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <p style="margin: 0 0 8px; font-size: 12px; color: #dc2626; font-weight: 600;">ALERTE STOCK FAIBLE — ${payload.storeName}</p>
      <h2 style="margin: 0 0 16px; font-size: 18px;">${payload.productName}</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 8px 0; color: #64748b;">Référence (SKU)</td><td style="padding: 8px 0; text-align: right; font-family: monospace;">${payload.productSku}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b; border-top: 1px solid #f1f5f9;">Stock actuel</td><td style="padding: 8px 0; text-align: right; font-weight: 700; color: #dc2626; border-top: 1px solid #f1f5f9;">${payload.currentStock} unité(s)</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b; border-top: 1px solid #f1f5f9;">Seuil d'alerte</td><td style="padding: 8px 0; text-align: right; border-top: 1px solid #f1f5f9;">${payload.thresholdUsed} unité(s)</td></tr>
      </table>
      <p style="margin: 20px 0 0; font-size: 13px; color: #475569;">Rendez-vous dans votre tableau de bord administrateur <strong>/admin</strong> pour réapprovisionner cet article ou importer votre dernière base de stock.</p>
    </div>
  `;

  // Option 1: Resend API if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.SMTP_FROM || '2Freres Phone <onboarding@resend.dev>',
          to: [payload.recipientEmail],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        return { status: 'failed', error: `Resend HTTP ${response.status}: ${errText.slice(0, 180)}` };
      }
      return { status: 'sent' };
    } catch (error: any) {
      return { status: 'failed', error: error?.message || 'Erreur Resend' };
    }
  }

  // Option 2: SMTP via nodemailer if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const { default: nodemailer } = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: payload.recipientEmail,
        subject,
        text: textBody,
        html: htmlBody,
      });
      return { status: 'sent' };
    } catch (error: any) {
      return { status: 'failed', error: error?.message || 'Erreur SMTP' };
    }
  }

  // Honest status when no SMTP / Resend key has been configured yet
  return {
    status: 'not_configured',
    error: 'Configurez SMTP_HOST/SMTP_USER/SMTP_PASS ou RESEND_API_KEY dans les variables d’environnement pour activer l’envoi réel d’e-mails.',
  };
}
