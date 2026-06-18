type Props = { children: string };

// Section eyebrow. Renders as an <h2> so the page has a real heading
// outline for screen readers (the page has a single <h1>, then these mark
// each section). Tailwind's preflight strips the UA heading styles, so the
// h2 looks identical to the old <div>.
export function SectionCaption({ children }: Props) {
  return (
    <h2 className="mono mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
      {children}
    </h2>
  );
}
