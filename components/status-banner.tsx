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
        : "border-[color:var(--line)] bg-white/70 text-slate";

  return (
    <div className={`rounded-3xl border px-5 py-4 ${toneClasses}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.3em]">{title}</p>
      <p className="mt-2 text-sm leading-6">{body}</p>
    </div>
  );
}
