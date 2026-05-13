type Props = { children: string };

export function SectionCaption({ children }: Props) {
  return (
    <div className="display mb-2 px-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--label-secondary)] lg:px-0">
      {children}
    </div>
  );
}
