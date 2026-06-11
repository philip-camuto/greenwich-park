import Link from "next/link";

type Props = { href: string; label?: string };

export function BackLink({ href, label = "Back" }: Props) {
  return (
    <Link
      href={href}
      className="mb-2 inline-flex w-fit items-center gap-1 rounded-[6px] border border-[var(--separator)] px-2.5 py-1.5 text-[13px] font-semibold text-[var(--label-secondary)] transition-colors hover:text-[var(--label-primary)]"
    >
      <span aria-hidden>{"<"}</span>
      <span>{label}</span>
    </Link>
  );
}
