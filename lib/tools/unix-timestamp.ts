export type TimestampUnit = "seconds" | "milliseconds" | "microseconds";

export function timestampToDate(value: number, unit: TimestampUnit): Date {
  const ms = unit === "seconds" ? value * 1000 : unit === "microseconds" ? value / 1000 : value;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid timestamp value.");
  return date;
}

export function dateToTimestamp(date: Date, unit: TimestampUnit): number {
  const ms = date.getTime();
  if (Number.isNaN(ms)) throw new Error("Invalid date.");
  if (unit === "seconds") return Math.floor(ms / 1000);
  if (unit === "microseconds") return ms * 1000;
  return ms;
}

export function nowTimestamp(unit: TimestampUnit): number {
  return dateToTimestamp(new Date(), unit);
}
