const POWER_AUTOMATE_URL = process.env.POWER_AUTOMATE_WEBHOOK_URL;

export async function sendEmail(
  subject: string,
  htmlBody: string,
  pdfBase64?: string,
  pdfFilename?: string
): Promise<boolean> {
  if (!POWER_AUTOMATE_URL) {
    console.error("POWER_AUTOMATE_WEBHOOK_URL not configured");
    return false;
  }

  try {
    const payload: Record<string, string> = {
      subject,
      body: htmlBody,
    };

    if (pdfBase64 && pdfFilename) {
      payload.attachmentContent = pdfBase64;
      payload.attachmentName = pdfFilename;
    }

    const response = await fetch(POWER_AUTOMATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.status === 200 || response.status === 202;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}
