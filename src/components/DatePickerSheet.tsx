"use client";

import { useState } from "react";

type Props = {
  initialDay?: string;
  initialTime?: string;
  onClose: () => void;
  onPick: (selection: { day: string; time?: string }) => void;
};

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

function maxISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-CA");
}

export function DatePickerSheet({ initialDay, initialTime = "", onClose, onPick }: Props) {
  const [day, setDay] = useState(initialDay ?? "today");
  const [customDate, setCustomDate] = useState(
    initialDay && /^\d{4}-\d{2}-\d{2}$/.test(initialDay) ? initialDay : "",
  );
  const [time, setTime] = useState(initialTime);
  const selectedDay = day === "custom" ? customDate : day;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[640px] flex-col gap-4 rounded-t-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] p-5 shadow-[0_-18px_40px_rgba(0,0,0,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[16px] font-semibold">Plan arrival</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["today", "Today"],
            ["tomorrow", "Tomorrow"],
            ["custom", "Date"],
          ].map(([value, label]) => {
            const selected = day === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setDay(value)}
                className={`min-h-[38px] rounded-[6px] text-[14px] font-semibold transition-all duration-200 ${
                  selected
                    ? "bg-[var(--bg-elevated)] text-[var(--label-primary)]"
                    : "border border-[var(--separator)] bg-transparent text-[var(--label-secondary)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {day === "custom" && (
          <label className="flex flex-col gap-1.5">
            <span className="mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
              Date
            </span>
            <input
              type="date"
              min={todayISO()}
              max={maxISO()}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="rounded-[6px] border border-[var(--separator)] bg-[var(--bg-elevated)] px-3 py-2 text-[15px] text-[var(--label-primary)]"
            />
          </label>
        )}
        <label className="flex items-center justify-between gap-3 rounded-[6px] border border-[var(--separator)] bg-[var(--bg-elevated)] px-3 py-2 text-[15px]">
          <span className="font-medium text-[var(--label-secondary)]">Time</span>
          <input
            type="time"
            aria-label="Planner time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onInput={(e) => setTime(e.currentTarget.value)}
            className="bg-transparent text-right font-semibold text-[var(--label-primary)] outline-none"
          />
        </label>
        <div className="mt-1 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] flex-1 rounded-[6px] border border-[var(--separator)] text-[15px] font-semibold text-[var(--label-secondary)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedDay}
            onClick={() => selectedDay && onPick({ day: selectedDay, time })}
            className="min-h-[40px] flex-1 rounded-[6px] bg-[var(--label-primary)] text-[15px] font-semibold text-[var(--bg-group)] disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
