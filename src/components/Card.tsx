import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: Props) {
  return (
    <div
      className={`bg-[var(--bg-surface)] rounded-[12px] px-4 py-4 ${className}`}
    >
      {children}
    </div>
  );
}
