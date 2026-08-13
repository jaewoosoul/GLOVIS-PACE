import { Badge, type BadgeTone } from "./Badge";

/** 위험도·처리상태 등 도메인 상태 문자열을 항상 텍스트 배지로 표시한다(색상만으로 구분하지 않음). */
const RISK_TONE: Record<string, BadgeTone> = {
  HIGH: "red",
  긴급: "red",
  MEDIUM: "yellow",
  운항기회: "blue",
  "운항 기회": "blue",
  LOW: "green",
  정상화신호: "green",
  "정상화 신호": "green",
  "영향 없음": "gray",
  "운항 무관": "gray",
};

export function StatusBadge({ label, tone }: { label: string; tone?: BadgeTone }) {
  const resolvedTone = tone ?? RISK_TONE[label] ?? "gray";
  return <Badge tone={resolvedTone}>{label}</Badge>;
}
