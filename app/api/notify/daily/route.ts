import { NextRequest } from "next/server";
import { getOutToday, formatDailyTeamsMessage } from "@/lib/notifications";
import { sendTeamsMessage } from "@/lib/teams-webhook";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const outToday = await getOutToday();
  const message = formatDailyTeamsMessage(outToday);
  const sent = await sendTeamsMessage(message);

  return Response.json({
    success: sent,
    outToday: outToday.length,
    message,
  });
}
