"use client";

import { useState, useTransition } from "react";
import { BLOCKS } from "@/components/avenue-map-data";
import { FIELD_RATING_OPTIONS } from "@/lib/field-calibration";

type Props = {
  initialBlockId: string;
  model: {
    confidence: string;
    observedAt: string;
    score: number;
  };
  perBlock: Record<string, { category: string; score: number }>;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saved"; error: number; id: number }
  | { kind: "error"; message: string };

export function LabForm({ initialBlockId, model, perBlock }: Props) {
  const [startedAt] = useState(() => Date.now());
  const [blockId, setBlockId] = useState(initialBlockId);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  const block = perBlock[blockId];
  const selectedRating = FIELD_RATING_OPTIONS.find((x) => x.rating === rating);
  const error =
    selectedRating && block ? selectedRating.score - block.score : null;

  function save() {
    if (rating == null) return;
    setSaveState({ kind: "idle" });
    startTransition(async () => {
      const res = await fetch("/api/field-observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId,
          clientElapsedMs: Date.now() - startedAt,
          notes,
          rating,
          website: "",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveState({ kind: "error", message: json.error ?? "save_failed" });
        return;
      }
      setSaveState({
        kind: "saved",
        error: json.observation.predictionError,
        id: json.observation.id,
      });
      setNotes("");
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] p-4">
        <div className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
          Current model
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="mono flex items-end gap-1.5 text-[72px] font-semibold leading-none tracking-[-0.055em] text-[var(--label-primary)]">
            <span>{block?.score ?? model.score}</span>
            <span className="mb-1.5 flex items-baseline text-[22px] font-medium tracking-[-0.04em] text-[var(--label-tertiary)]">
              <span className="opacity-45">/</span>
              <span className="ml-0.5">100</span>
            </span>
          </div>
          <div className="mb-2 text-right text-[13px] text-[var(--label-secondary)]">
            <div>{block?.category ?? "unknown"}</div>
            <div>{model.confidence} confidence</div>
          </div>
        </div>
        <p className="mt-4 border-t border-[var(--separator)] pt-4 text-[13px] leading-relaxed text-[var(--label-secondary)]">
          This is the model&apos;s block-level prediction. Your field rating
          becomes ground truth for the same block and timestamp.
        </p>
      </section>

      <aside className="rounded-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] p-4">
        <div className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
          Meaning
        </div>
        <dl className="mt-3 grid gap-2 text-[13px]">
          <Meaning label="0-20" value="Empty" />
          <Meaning label="21-40" value="Easy" />
          <Meaning label="41-60" value="Competitive" />
          <Meaning label="61-80" value="Hard" />
          <Meaning label="81-100" value="Packed" />
        </dl>
      </aside>

      <section className="rounded-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] p-4 lg:col-span-2">
        <div className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
          Where are you?
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BLOCKS.map((blockOption) => {
            const selected = blockOption.id === blockId;
            const score = perBlock[blockOption.id]?.score;
            return (
              <button
                key={blockOption.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setBlockId(blockOption.id)}
                className={`min-h-[54px] rounded-[6px] border px-3 py-2 text-left transition-colors ${
                  selected
                    ? "border-[var(--label-secondary)] bg-[var(--bg-elevated)]"
                    : "border-[var(--separator)] hover:border-[var(--separator-inset)]"
                }`}
              >
                <span className="block text-[13px] font-semibold text-[var(--label-primary)]">
                  {blockOption.label.replace("Between ", "")}
                </span>
                <span className="mono mt-1 block text-[12px] text-[var(--label-tertiary)]">
                  predicted {score ?? "-"} / 100
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] p-4 lg:col-span-2">
        <div className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
          What did you see?
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FIELD_RATING_OPTIONS.map((option) => {
            const selected = option.rating === rating;
            return (
              <button
                key={option.rating}
                type="button"
                aria-pressed={selected}
                onClick={() => setRating(option.rating)}
                className={`min-h-[72px] rounded-[6px] border px-3 py-2 text-left transition-colors ${
                  selected
                    ? "border-[var(--label-secondary)] bg-[var(--bg-elevated)]"
                    : "border-[var(--separator)] hover:border-[var(--separator-inset)]"
                }`}
              >
                <span className="mono block text-[22px] font-semibold text-[var(--label-primary)]">
                  {option.rating}
                  <span className="text-[12px] text-[var(--label-tertiary)]">
                    {" "}
                    {">"} {option.score}
                  </span>
                </span>
                <span className="mt-1 block text-[13px] text-[var(--label-secondary)]">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[8px] border border-[var(--separator)] bg-[var(--bg-surface)] p-4 lg:col-span-2">
        <label className="block">
          <span className="mono text-[11px] uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
            Optional note
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Example: both sides full near Terra; side street had two spaces."
            className="mt-3 min-h-[96px] w-full resize-y rounded-[6px] border border-[var(--separator)] bg-[var(--bg-elevated)] px-3 py-2 text-[14px] text-[var(--label-primary)] outline-none placeholder:text-[var(--label-tertiary)]"
          />
        </label>

        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--separator)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[13px] text-[var(--label-secondary)]">
            {error == null
              ? `Model row: ${new Date(model.observedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : `Training error: ${error > 0 ? "+" : ""}${error} points`}
          </div>
          <button
            type="button"
            disabled={rating == null || isPending}
            onClick={save}
            className="min-h-[42px] rounded-[6px] bg-[var(--label-primary)] px-4 text-[14px] font-semibold text-[var(--bg-group)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Saving..." : "Save observation"}
          </button>
        </div>

        {saveState.kind === "saved" && (
          <p className="mt-3 text-[13px] text-[var(--state-quiet)]">
            Saved observation #{saveState.id}. Error was{" "}
            {saveState.error > 0 ? "+" : ""}
            {saveState.error}.
          </p>
        )}
        {saveState.kind === "error" && (
          <p className="mt-3 text-[13px] text-[var(--state-tough)]">
            Save failed: {messageForError(saveState.message)}
          </p>
        )}
      </section>
    </div>
  );
}

function messageForError(message: string) {
  if (message === "too_fast") {
    return "that was submitted too quickly, so it looked automated.";
  }
  if (message === "too_many_submissions") {
    return "too many recent submissions from this browser. Try again in a few minutes.";
  }
  if (message === "spam_rejected") {
    return "spam filter caught the hidden field.";
  }
  return message;
}

function Meaning({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--separator)] pb-2 last:border-b-0 last:pb-0">
      <dt className="mono text-[12px] text-[var(--label-tertiary)]">{label}</dt>
      <dd className="font-medium text-[var(--label-primary)]">{value}</dd>
    </div>
  );
}
