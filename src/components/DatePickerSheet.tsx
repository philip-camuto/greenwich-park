"use client";

import { useState } from "react";

type Props = {
  onClose: () => void;
  onPick: (isoDate: string) => void;
};

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

function maxISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("en-CA");
}

export function DatePickerSheet({ onClose, onPick }: Props) {
  const [value, setValue] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-surface)] w-full max-w-[640px] rounded-t-[16px] p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="display text-[17px] font-semibold">Pick a day</div>
        <input
          type="date"
          min={todayISO()}
          max={maxISO()}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="text-[17px] border border-[var(--separator)] rounded-[8px] px-3 py-2"
        />
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-[10px] border border-[var(--separator)] text-[17px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!value}
            onClick={() => value && onPick(value)}
            className="flex-1 min-h-[44px] rounded-[10px] bg-[var(--link)] text-white text-[17px] disabled:opacity-40"
          >
            Pick
          </button>
        </div>
      </div>
    </div>
  );
}
