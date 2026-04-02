import { NextRequest } from "next/server";
import { getWeekSummary, getTotalMembers, getTeamAvailability } from "@/lib/notifications";
import { generateWeeklyPdf } from "@/lib/pdf-report";
import { sendEmail } from "@/lib/email";
import { format, startOfWeek, addDays } from "date-fns";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [weekSummary, totalMembers, teamAvail] = await Promise.all([
    getWeekSummary(),
    getTotalMembers(),
    getTeamAvailability(),
  ]);

  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const friday = addDays(monday, 4);
  const weekLabel = `${format(monday, "MMM d")} – ${format(friday, "MMM d, yyyy")}`;

  const subject = `FlexiGenAI — Week of ${weekLabel}`;

  const pdfBuffer = await generateWeeklyPdf(weekSummary, totalMembers, teamAvail);
  const pdfBase64 = pdfBuffer.toString("base64");
  const filename = `flexigenai-weekly-${format(monday, "yyyy-MM-dd")}.pdf`;

  const body = `<div style="font-family:-apple-system,sans-serif;font-size:14px;color:#333;">
    <p>Here's your weekly team tracker digest — report attached.</p>
    <p style="color:#888;font-size:12px;">
      <a href="https://ey-vacation-tracker.vercel.app/dashboard" style="color:#111;font-weight:600;">Open Dashboard</a> ·
      <a href="https://ey-vacation-tracker.vercel.app" style="color:#888;">View Calendar</a>
    </p>
  </div>`;

  const sent = await sendEmail(subject, body, pdfBase64, filename);

  return Response.json({ success: sent, daysWithAbsences: weekSummary.size });
}
