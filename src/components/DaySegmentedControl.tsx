"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DatePickerSheet } from "./DatePickerSheet";

type Segment = { value: string; label: string };

const SEGMENTS: Segment[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
];

export function DaySegmentedControl() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("day") ?? "today";
  const [pickerOpen, setPickerOpen] = useState(false);

  function select(value: string) {
    const p = new URLSearchParams(params.toString());
    if (value === "today") p.delete("day");
    else p.set("day", value);
    router.push(`/?${p.toString()}`);
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
      <div className="bg-[#e5e5ea] rounded-[8px] p-[2px] flex gap-[2px] mb-4">
        {SEGMENTS.map((s) => {
          const selected = current === s.value || (current === "today" && s.value === "today");
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={selected}
              onClick={() => select(s.value)}
              className={`flex-1 text-[14px] font-medium py-[6px] rounded-[7px] transition-colors ${
                selected
                  ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] text-[var(--label-primary)]"
                  : "text-[var(--label-secondary)]"
              }`}
            >
              {s.label}
            </button>
          );
        })}
        <button
          key="pick"
          type="button"
          aria-pressed={!!customLabel}
          onClick={() => setPickerOpen(true)}
          className={`flex-1 text-[14px] font-medium py-[6px] rounded-[7px] transition-colors ${
            customLabel
              ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] text-[var(--label-primary)]"
              : "text-[var(--label-secondary)]"
          }`}
        >
          {customLabel ?? "+ Pick day"}
        </button>
      </div>
      {pickerOpen && (
        <DatePickerSheet
          onClose={() => setPickerOpen(false)}
          onPick={(isoDate) => {
            setPickerOpen(false);
            select(isoDate);
          }}
        />
      )}
    </>
  );
}
