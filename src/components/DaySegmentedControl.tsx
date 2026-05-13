"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { DatePickerSheet } from "./DatePickerSheet";

// Two-option toggle: today vs. anything-not-today. Tomorrow used to be its
// own chip, but the picker sheet handles that case with one extra tap.

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
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex min-h-[44px] w-full items-center justify-between rounded-[12px] bg-[#e5e5ea] px-3 text-left text-[15px] font-semibold text-[var(--label-primary)]"
        >
          <span>{plannerLabel(current, currentTime)}</span>
          <span
            aria-hidden
            className="h-2 w-2 rotate-45 border-b-2 border-r-2 border-[var(--label-secondary)]"
          />
        </button>
      </div>

      <div
        className={`mb-4 hidden items-center gap-2 rounded-[12px] bg-[#e5e5ea] p-[3px] transition-opacity duration-200 lg:inline-flex ${
          isPending ? "opacity-70" : "opacity-100"
        }`}
        aria-label="Plan a trip"
      >
        <button
          type="button"
          aria-pressed={current === "today"}
          onClick={() => select("today")}
          className={`min-h-[34px] rounded-[9px] px-4 text-[14px] font-semibold transition-all duration-200 ${
            current === "today"
              ? "bg-white text-[var(--label-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              : "text-[var(--label-secondary)] hover:text-[var(--label-primary)]"
          }`}
        >
          Today
        </button>
        <button
          type="button"
          aria-pressed={current !== "today"}
          onClick={() => setPickerOpen(true)}
          className={`min-h-[34px] rounded-[9px] px-4 text-[14px] font-semibold transition-all duration-200 ${
            current !== "today"
              ? "bg-white text-[var(--label-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
              : "text-[var(--label-secondary)] hover:text-[var(--label-primary)]"
          }`}
        >
          {customLabel ?? "Another date…"}
        </button>

        <span aria-hidden className="px-1 text-[14px] text-[var(--label-tertiary)]">
          at
        </span>

        <input
          type="time"
          aria-label="Time of day"
          value={currentTime}
          onChange={(e) => selectTime(e.target.value)}
          onInput={(e) => selectTime(e.currentTarget.value)}
          className="min-h-[34px] rounded-[9px] bg-white px-3 text-[14px] font-semibold text-[var(--label-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.08)] outline-none"
        />
        {currentTime && (
          <button
            type="button"
            onClick={() => selectTime("")}
            aria-label="Clear time"
            className="min-h-[34px] rounded-[9px] px-2 text-[14px] font-medium text-[var(--label-tertiary)] hover:text-[var(--label-primary)]"
          >
            ✕
          </button>
        )}
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
