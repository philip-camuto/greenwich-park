type Props = { children: string };

export function SectionCaption({ children }: Props) {
  return (
    <div className="display text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--label-secondary)] px-4 mb-2">
      {children}
    </div>
  );
}
