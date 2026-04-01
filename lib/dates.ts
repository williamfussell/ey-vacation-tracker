import {
  format,
  addDays,
  startOfWeek,
  isWeekend,
  isToday,
  isSameDay,
  isMonday,
  eachDayOfInterval,
  parseISO,
  getDate,
} from "date-fns";

export {
  format,
  addDays,
  isWeekend,
  isToday,
  isSameDay,
  isMonday,
  eachDayOfInterval,
  parseISO,
  getDate,
};

export function getGridDays(startDate: Date, numWeeks: number): Date[] {
  const start = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday
  const days: Date[] = [];
  for (let i = 0; i < numWeeks * 7; i++) {
    days.push(addDays(start, i));
  }
  return days;
}

export function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function isDateInRange(
  date: Date,
  startDate: string,
  endDate: string
): boolean {
  const d = toDateString(date);
  return d >= startDate && d <= endDate;
}

export function getMonthHeaders(
  days: Date[]
): { label: string; span: number }[] {
  const headers: { label: string; span: number }[] = [];
  let current = "";
  let count = 0;

  for (const day of days) {
    const label = format(day, "MMMM yyyy");
    if (label === current) {
      count++;
    } else {
      if (current) headers.push({ label: current, span: count });
      current = label;
      count = 1;
    }
  }
  if (current) headers.push({ label: current, span: count });
  return headers;
}
