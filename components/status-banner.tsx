type StatusBannerProps = {
  title: string;
  body: string;
  tone?: "neutral" | "success" | "error";
};

export function StatusBanner({ title, body, tone = "neutral" }: StatusBannerProps) {
  const toneClasses =
    tone === "success"
      ? "border-moss/30 bg-moss/10 text-moss"
      : tone === "error"
        ? "border-ember/30 bg-ember/10 text-ember"
        : "border-[color:var(--line)] bg-white/75 text-slate";

  return (
    <div className={`glass-tile px-5 py-4 ${toneClasses}`}>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.34em]">{title}</p>
      <p className="mt-2 text-sm leading-6">{body}</p>
    </div>
  );
}
