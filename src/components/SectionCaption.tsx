type Props = { children: string };

export function SectionCaption({ children }: Props) {
  return (
    <div className="mono mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--label-tertiary)]">
      {children}
    </div>
  );
}
