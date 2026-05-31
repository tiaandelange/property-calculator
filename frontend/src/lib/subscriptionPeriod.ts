export type CalendarMonthPeriod = {
  start: Date;
  end: Date;
  label: string;
};

export function calendarMonthPeriod(now = new Date()): CalendarMonthPeriod {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end, label: "This calendar month" };
}

export function calendarMonthIsoBounds(now = new Date()): { start: string; end: string } {
  const { start, end } = calendarMonthPeriod(now);
  return { start: start.toISOString(), end: end.toISOString() };
}
