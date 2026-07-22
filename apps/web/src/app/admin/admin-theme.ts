export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const adminTheme = {
  appBackground:
    "bg-[#F3F6F8]",
  atretuMark:
    "bg-[#0F2E2E] text-white shadow-[0_10px_22px_rgba(15,46,46,0.18)] ring-1 ring-white/20",
  brandAccent: "border-[#1F6F5F]",
  card:
    "rounded-xl border border-slate-200/80 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_rgba(15,46,46,0.035)]",
  cardHover:
    "transition-[border-color,box-shadow,transform,background-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-[#8DB7AD] hover:shadow-[0_10px_28px_rgba(15,46,46,0.09)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
  control:
    "h-10 rounded-lg border border-slate-300/80 bg-white px-3 text-sm text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition duration-150 focus:border-[#1F6F5F] focus:ring-4 focus:ring-[#1F6F5F]/15 disabled:bg-slate-50 disabled:text-slate-400 motion-reduce:transition-none",
  focus:
    "focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 focus:ring-offset-2",
  iconButton:
    "grid h-10 w-10 place-items-center rounded-lg border border-slate-200/90 bg-white/85 text-slate-700 shadow-sm transition duration-150 hover:border-[#8DB7AD] hover:bg-[#F2F8F6] hover:text-[#0F2E2E] focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 motion-reduce:transition-none",
  page:
    "mx-auto grid w-full max-w-[1520px] gap-6 px-4 py-5 sm:px-6 lg:px-8",
  primaryButton:
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#0F2E2E] bg-[#0F2E2E] px-3 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[#174443] focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 motion-reduce:transition-none",
  secondaryButton:
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300/90 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition duration-150 hover:border-[#8DB7AD] hover:bg-[#F2F8F6] hover:text-[#0F2E2E] focus:outline-none focus:ring-4 focus:ring-[#1F6F5F]/15 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 motion-reduce:transition-none",
  routeRail:
    "before:absolute before:left-0 before:top-5 before:h-[calc(100%-2.5rem)] before:w-px before:bg-[#C8DAD4]",
  softPanel: "rounded-xl border border-slate-200/70 bg-[#F8FAFA]/85",
  subtleText: "text-slate-500",
  titleText: "font-semibold tracking-normal text-slate-950",
};
