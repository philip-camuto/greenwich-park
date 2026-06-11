"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { DatePickerSheet } from "./DatePickerSheet";
import { GREENWICH_TZ } from "@/lib/utils/time";

// Two-option toggle: today vs. anything-not-today. Tomorrow used to be its
// own chip, but the picker sheet handles that case with one extra tap.
// Flanked by arrow buttons that step the displayed day by one in either
// direction. Past days clamp to today.

function formatGreenwichYMD(d: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: GREENWICH_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function DaySegmentedControl() {
  const router = useRouter();
  const params = useSearchParams();
  const routeDay = params.get("day") ?? "today";
  const routeTime = params.get("time") ?? "";
  const [optimistic, setOptimistic] = useOptimistic(
    { day: routeDay, time: routeTime },
    (_state, next: { day: string; time: string }) => next,
  );
  const current = optimistic.day;
  const currentTime = optimistic.time;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function updateUrl(nextDay: string, nextTime = currentTime) {
    const p = new URLSearchParams(params.toString());
    if (nextDay === "today") p.delete("day");
    else p.set("day", nextDay);
    if (nextTime) p.set("time", nextTime);
    else p.delete("time");
    const query = p.toString();
    startTransition(() => {
      router.replace(query ? `/?${query}` : "/", { scroll: false });
    });
  }

  function select(value: string) {
    setOptimistic({ day: value, time: currentTime });
    updateUrl(value);
  }

  function selectTime(value: string) {
    setOptimistic({ day: current, time: value });
    updateUrl(current, value);
  }

  function isCustomDate(v: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(v);
  }

  function stepDay(direction: -1 | 1) {
    const now = new Date();
    const todayISO = formatGreenwichYMD(now);
    let currentISO: string;
    if (current === "today") {
      currentISO = todayISO;
    } else if (current === "tomorrow") {
      const t = new Date(`${todayISO}T12:00:00Z`);
      t.setUTCDate(t.getUTCDate() + 1);
      currentISO = formatGreenwichYMD(t);
    } else if (isCustomDate(current)) {
      currentISO = current;
    } else {
      currentISO = todayISO;
    }
    const d = new Date(`${currentISO}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + direction);
    const nextISO = formatGreenwichYMD(d);
    if (nextISO < todayISO) {
      select("today");
    } else if (nextISO === todayISO && !currentTime) {
      select("today");
    } else {
      setOptimistic({ day: nextISO, time: currentTime });
      updateUrl(nextISO, currentTime);
    }
  }

  const customLabel =
    current && isCustomDate(current)
      ? new Date(current + "T12:00:00Z").toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <>
      <div className="mb-4 flex items-stretch gap-2 lg:hidden">
        <DayStepButton direction={-1} onClick={() => stepDay(-1)} />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex min-h-[40px] flex-1 items-center justify-between rounded-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] px-3 text-left text-[14px] font-semibold text-[var(--label-primary)]"
        >
          <span>{plannerLabel(current, currentTime)}</span>
          <span
            aria-hidden
            className="h-2 w-2 rotate-45 border-b-2 border-r-2 border-[var(--label-secondary)]"
          />
        </button>
        <DayStepButton direction={1} onClick={() => stepDay(1)} />
      </div>

      <div className="hidden items-center gap-1 lg:inline-flex">
        <DayStepButton direction={-1} onClick={() => stepDay(-1)} />
        <div
          className={`flex items-center gap-1 rounded-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] p-1 transition-opacity duration-200 ${
            isPending ? "opacity-70" : "opacity-100"
          }`}
          aria-label="Plan a trip"
        >
        <button
          type="button"
          aria-pressed={current === "today"}
          onClick={() => select("today")}
          className={`min-h-[32px] rounded-[6px] px-3 text-[13px] font-semibold transition-all duration-200 ${
            current === "today"
              ? "bg-[var(--bg-elevated)] text-[var(--label-primary)]"
              : "text-[var(--label-secondary)] hover:text-[var(--label-primary)]"
          }`}
        >
          Today
        </button>
        <button
          type="button"
          aria-pressed={current !== "today"}
          onClick={() => setPickerOpen(true)}
          className={`min-h-[32px] rounded-[6px] px-3 text-[13px] font-semibold transition-all duration-200 ${
            current !== "today"
              ? "bg-[var(--bg-elevated)] text-[var(--label-primary)]"
              : "text-[var(--label-secondary)] hover:text-[var(--label-primary)]"
          }`}
        >
          {customLabel ?? "Another date"}
        </button>

        <span aria-hidden className="px-1 text-[12px] text-[var(--label-tertiary)]">
          at
        </span>

        <input
          type="time"
          aria-label="Time of day"
          value={currentTime}
          onChange={(e) => selectTime(e.target.value)}
          onInput={(e) => selectTime(e.currentTarget.value)}
          className="mono min-h-[32px] rounded-[6px] bg-[var(--bg-elevated)] px-2.5 text-[13px] font-medium text-[var(--label-primary)] outline-none"
        />
        {currentTime && (
          <button
            type="button"
            onClick={() => selectTime("")}
            aria-label="Clear time"
            className="min-h-[32px] rounded-[6px] px-2 text-[13px] font-medium text-[var(--label-tertiary)] hover:text-[var(--label-primary)]"
          >
            x
          </button>
        )}
        </div>
        <DayStepButton direction={1} onClick={() => stepDay(1)} />
      </div>
      {pickerOpen && (
        <DatePickerSheet
          initialDay={current}
          initialTime={currentTime}
          onClose={() => setPickerOpen(false)}
          onPick={(selection) => {
            setPickerOpen(false);
            setOptimistic({ day: selection.day, time: selection.time ?? "" });
            updateUrl(selection.day, selection.time ?? "");
          }}
        />
      )}
    </>
  );
}

function DayStepButton({
  direction,
  onClick,
}: {
  direction: -1 | 1;
  onClick: () => void;
}) {
  const isLeft = direction === -1;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? "Previous day" : "Next day"}
      className="flex min-h-[40px] w-10 items-center justify-center rounded-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] text-[var(--label-secondary)] transition-colors hover:text-[var(--label-primary)] lg:min-h-[34px]"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
      >
        <path
          d={isLeft ? "M10 4 6 8l4 4" : "M6 4l4 4-4 4"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function plannerLabel(day: string, time: string): string {
  const dayLabel =
    day === "today"
      ? "Today"
      : day === "tomorrow"
        ? "Tomorrow"
        : new Date(day + "T12:00:00Z").toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
  return time ? `${dayLabel} · ${formatTime(time)}` : dayLabel;
}

function formatTime(time: string): string {
  const [hourRaw, minute] = time.split(":");
  const hour = parseInt(hourRaw, 10);
  if (Number.isNaN(hour)) return time;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}
