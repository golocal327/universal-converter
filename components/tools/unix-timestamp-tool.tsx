"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "@/components/converter/copy-button";
import { dateToTimestamp, nowTimestamp, timestampToDate, type TimestampUnit } from "@/lib/tools/unix-timestamp";

export function UnixTimestampTool() {
  const [now, setNow] = useState<number | null>(null);
  const [timestamp, setTimestamp] = useState("");
  const [unit, setUnit] = useState<TimestampUnit>("seconds");
  const [isoInput, setIsoInput] = useState("");

  useEffect(() => {
    // "Current time" is inherently non-deterministic between server and client
    // render passes, so it MUST be deferred to a post-mount effect (there is no
    // synchronous, hydration-safe way to compute "now" during render).
    /* eslint-disable react-hooks/set-state-in-effect */
    const value = nowTimestamp("seconds");
    setNow(value);
    setTimestamp(String(value));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  let dateFromTimestamp: string | null = null;
  let timestampError: string | null = null;
  try {
    if (timestamp.trim()) dateFromTimestamp = timestampToDate(Number(timestamp), unit).toISOString();
  } catch (err) {
    timestampError = err instanceof Error ? err.message : "Invalid timestamp";
  }

  let timestampFromDate: number | null = null;
  let dateError: string | null = null;
  try {
    if (isoInput.trim()) timestampFromDate = dateToTimestamp(new Date(isoInput), unit);
  } catch (err) {
    dateError = err instanceof Error ? err.message : "Invalid date";
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">Current Unix timestamp: <span className="font-mono text-foreground">{now ?? "…"}</span></p>
        <select value={unit} onChange={(e) => setUnit(e.target.value as TimestampUnit)} className="h-9 rounded-lg border border-border bg-background px-2 text-xs">
          <option value="seconds">Seconds</option>
          <option value="milliseconds">Milliseconds</option>
          <option value="microseconds">Microseconds</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Timestamp → Date (UTC)</label>
          <input
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-background px-4 font-mono text-lg focus:border-accent focus:outline-none"
          />
          <p className="mt-2 text-sm">
            {timestampError ? <span className="text-danger">{timestampError}</span> : dateFromTimestamp}
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Date (ISO 8601) → Timestamp</label>
          <input
            value={isoInput}
            onChange={(e) => setIsoInput(e.target.value)}
            placeholder="2024-01-01T00:00:00Z"
            className="h-12 w-full rounded-xl border border-border bg-background px-4 font-mono text-lg focus:border-accent focus:outline-none"
          />
          <p className="mt-2 text-sm">
            {dateError ? <span className="text-danger">{dateError}</span> : timestampFromDate}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <CopyButton text={dateFromTimestamp ?? ""} />
      </div>
    </div>
  );
}
