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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[640px] flex-col gap-4 rounded-t-[18px] bg-[var(--bg-surface)] p-5 shadow-[0_-18px_40px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[17px] font-semibold">Plan arrival</div>
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
                className={`min-h-[40px] rounded-[10px] text-[15px] font-semibold transition-all duration-200 ${
                  selected
                    ? "bg-[var(--label-primary)] text-[var(--bg-surface)]"
                    : "bg-[var(--bg-group)] text-[var(--label-primary)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <input
          type="date"
          min={todayISO()}
          max={maxISO()}
          value={customDate}
          onChange={(e) => {
            setCustomDate(e.target.value);
            setDay("custom");
          }}
          className="rounded-[10px] border border-[var(--separator)] px-3 py-2 text-[17px]"
        />
        <label className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--separator)] px-3 py-2 text-[17px]">
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
            className="min-h-[44px] flex-1 rounded-[10px] border border-[var(--separator)] text-[17px] font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedDay}
            onClick={() => selectedDay && onPick({ day: selectedDay, time })}
            className="min-h-[44px] flex-1 rounded-[10px] bg-[var(--link)] text-[17px] font-semibold text-white disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
