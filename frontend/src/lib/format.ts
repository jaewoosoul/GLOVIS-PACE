export function formatUsd(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : rounded > 0 ? "+" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

export function formatUsdPlain(value: number): string {
  return `$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

export function formatHoursKo(value: number, digits = 0): string {
  return `${value.toFixed(digits)}시간`;
}

export function formatTons(value: number, digits = 1): string {
  return `${value.toFixed(digits)}t`;
}

export function formatKnots(value: number): string {
  return `${value.toFixed(1)}kn`;
}

/** SpeedOptionId("A"~"D")를 소문자로 표시한다 — GLOVIS-A~E(선박명) 대문자와 화면에서 헷갈리지 않도록. */
export function formatOptionId(optionId: string): string {
  const map: Record<string, string> = { A: "1", B: "2", C: "3", D: "4" };
  return map[optionId.toUpperCase()] ?? optionId;
}

/** ISO 시각을 "MM/DD HH:mm"(KST 기준)으로 표시한다. */
export function formatIsoLabel(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
