import { Resend } from "resend";

export async function sendEmail(
  subject: string,
  htmlBody: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFICATION_EMAIL_TO;
  const from = process.env.NOTIFICATION_EMAIL_FROM || "vacations@yourdomain.com";

  if (!apiKey || !to) {
    console.error("RESEND_API_KEY or NOTIFICATION_EMAIL_TO not configured");
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: to.split(",").map((e) => e.trim()),
      subject,
      html: htmlBody,
    });
    if (error) {
      console.error("Failed to send email:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}
