import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

/**
 * A layout component that wraps content in a stylized section panel.
 * 
 * * @param {SectionCardProps} props - the component props
 * @param {string} props.title - the primary heading for the section
 * @param {string} props.subtitle - secondary text displayed above the title for context
 * @param {ReactNode} props.children - the content to be rendered within the card body
 * @returns {JSX.Element} the rendered SectionCard component
 */
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
