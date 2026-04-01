import { NextRequest } from "next/server";
import {
  getWeekSummary,
  formatWeeklyTeamsMessage,
  formatWeeklyEmailHtml,
} from "@/lib/notifications";
import { sendTeamsMessage } from "@/lib/teams-webhook";
import { sendEmail } from "@/lib/email";
import { format, startOfWeek, addDays } from "date-fns";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const weekSummary = await getWeekSummary();

  // Send Teams message
  const teamsMessage = formatWeeklyTeamsMessage(weekSummary);
  const teamsSent = await sendTeamsMessage(teamsMessage);

  // Send email
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const friday = addDays(monday, 4);
  const weekLabel = `${format(monday, "MMM d")} – ${format(friday, "MMM d, yyyy")}`;
  const emailHtml = formatWeeklyEmailHtml(weekSummary);
  const emailSent = await sendEmail(
    `EY Vacation Tracker — Week of ${weekLabel}`,
    emailHtml
  );

  return Response.json({
    success: teamsSent || emailSent,
    teamsSent,
    emailSent,
    daysWithAbsences: weekSummary.size,
  });
}
