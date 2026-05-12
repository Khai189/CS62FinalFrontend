import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <section className="rounded-4xl border border-white/60 bg-[rgba(255,252,247,0.86)] p-6 shadow-card backdrop-blur md:p-8">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate">{subtitle}</p>
        <h2 className="mt-2 text-2xl text-ink md:text-3xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}
