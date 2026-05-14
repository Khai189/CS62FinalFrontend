import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <section className="surface-panel p-6 md:p-8">
      <div className="mb-5">
        <p className="section-eyebrow">{subtitle}</p>
        <h2 className="mt-2 text-2xl text-ink md:text-3xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}
