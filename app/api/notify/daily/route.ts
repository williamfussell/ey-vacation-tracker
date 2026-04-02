import { NextRequest } from "next/server";
import { getOutForDate, getTotalMembers, getTeamAvailability, getNext5DaysOutCount } from "@/lib/notifications";
import { generateDailyEmailImage } from "@/lib/email-image";
import { sendEmail } from "@/lib/email";
import { format, addDays } from "date-fns";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const [outToday, outTomorrow, totalMembers, teamAvail, next5Days] = await Promise.all([
    getOutForDate(today),
    getOutForDate(tomorrow),
    getTotalMembers(),
    getTeamAvailability(),
    getNext5DaysOutCount(),
  ]);

  const png = await generateDailyEmailImage(outToday, outTomorrow, totalMembers, teamAvail, next5Days);
  const pngBase64 = png.toString("base64");

  const subject = outToday.length > 0
    ? `Team Daily PTO Update — ${outToday.length} out today`
    : "Team Daily PTO Update — Full team today";

  const body = `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
    <img src="data:image/png;base64,${pngBase64}" width="600" style="width:100%;height:auto;display:block;border-radius:8px;" alt="Daily Team Report" />
    <p style="text-align:center;margin-top:16px;">
      <a href="https://ey-vacation-tracker.vercel.app/dashboard" style="color:#111;font-size:13px;font-weight:600;text-decoration:none;">Open Dashboard</a>
      <span style="color:#ddd;margin:0 8px;">|</span>
      <a href="https://ey-vacation-tracker.vercel.app" style="color:#999;font-size:13px;text-decoration:none;">View Calendar</a>
    </p>
  </div>`;

  const sent = await sendEmail(subject, body);

  return Response.json({ success: sent, outToday: outToday.length, outTomorrow: outTomorrow.length });
}
