export function renderVerdict(template: string, stat: number): string {
  return template
    .replaceAll("{stat}", stat.toLocaleString("en-US"))
    .replace(/\s*\n+\s*/g, " ")
    .replace(/[–—―]/g, "-")
    .trim();
}
