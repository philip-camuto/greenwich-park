import Link from "next/link";

type Props = { href: string; label?: string };

export function BackLink({ href, label = "Back" }: Props) {
  return (
    <Link
      href={href}
      className="text-[17px] text-[var(--link)] flex items-center gap-1 mb-4"
    >
      <span aria-hidden>‹</span>
      <span>{label}</span>
    </Link>
  );
}
