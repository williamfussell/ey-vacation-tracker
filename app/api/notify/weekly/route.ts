import { NextRequest } from "next/server";
import { getWeekSummary, getTotalMembers, getTeamAvailability } from "@/lib/notifications";
import { generateWeeklyEmailImage } from "@/lib/email-image";
import { sendEmail } from "@/lib/email";
import { format, startOfWeek, addDays, eachDayOfInterval } from "date-fns";

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

  // Build week days array for image
  const days = eachDayOfInterval({ start: monday, end: friday });
  const weekDays = days.map((d) => {
    const dayLabel = format(d, "EEEE, MMM d");
    return {
      label: dayLabel,
      members: weekSummary.get(dayLabel) || [],
    };
  });

  const png = await generateWeeklyEmailImage(weekDays, totalMembers, teamAvail, weekLabel);
  const pngBase64 = png.toString("base64");

  const subject = `Team Weekly PTO Digest — ${weekLabel}`;

  const body = `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
    <img src="data:image/png;base64,${pngBase64}" width="600" style="width:100%;height:auto;display:block;border-radius:8px;" alt="Weekly Team Report" />
    <p style="text-align:center;margin-top:16px;">
      <a href="https://ey-vacation-tracker.vercel.app/dashboard" style="color:#111;font-size:13px;font-weight:600;text-decoration:none;">Open Dashboard</a>
      <span style="color:#ddd;margin:0 8px;">|</span>
      <a href="https://ey-vacation-tracker.vercel.app" style="color:#999;font-size:13px;text-decoration:none;">View Calendar</a>
    </p>
  </div>`;

  const sent = await sendEmail(subject, body);

  return Response.json({ success: sent, daysWithAbsences: weekSummary.size });
}
