import type { KnownPort } from "../news/newsAnalysisSchema.js";
import type { RtaAnalysis } from "./rtaAnalysisSchema.js";

export interface RtaAnalysisValidationResult {
  analysis: RtaAnalysis;
  /** 검증 과정에서 발견해 정정한 내용. analysis.uncertainties에도 병합되지만, 로그용으로 따로 반환한다. */
  warnings: string[];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Claude의 RTA 분석 결과를 그대로 신뢰하지 않고 후처리 검증한다(뉴스 검증과 동일한 원칙).
 * - 근거 문장이 실제 RTA 원문에 있는지 확인한다.
 * - 항만 canonicalName/unLocode가 항만 마스터와 일치하는지 확인한다.
 * - 구간(fromEtaIso가 없는 비개방형 구간)에 값이 빠져 있으면 uncertainties에 남긴다.
 */
export function validateRtaAnalysis(raw: RtaAnalysis, rtaText: string, knownPorts: KnownPort[]): RtaAnalysisValidationResult {
  const warnings: string[] = [];
  let analysis: RtaAnalysis = raw;

  const haystack = normalizeText(rtaText);
  const verifiedEvidence = analysis.evidence.filter((item) => {
    const found = haystack.includes(normalizeText(item.quote));
    if (!found) warnings.push(`원문에서 확인되지 않은 근거 문장을 제거했습니다: "${item.quote}"`);
    return found;
  });
  if (verifiedEvidence.length !== analysis.evidence.length) {
    analysis = { ...analysis, evidence: verifiedEvidence };
  }

  if (!analysis.portCanonicalName && !analysis.portUnLocode) {
    // 이미 null이면 손댈 것이 없다.
  } else {
    const match = knownPorts.find(
      (kp) =>
        (analysis.portUnLocode !== null && kp.unLocode === analysis.portUnLocode) ||
        (analysis.portCanonicalName !== null && kp.canonicalName.toLowerCase() === analysis.portCanonicalName.toLowerCase()),
    );
    if (!match) {
      warnings.push(`항만 마스터와 일치하지 않는 항만 정보를 정리했습니다: "${analysis.portMentionedName}"`);
      analysis = { ...analysis, portCanonicalName: null, portUnLocode: null };
    } else {
      analysis = { ...analysis, portCanonicalName: match.canonicalName, portUnLocode: match.unLocode };
    }
  }

  const incompleteBands = analysis.etaBands.filter((band) => !band.isOpenEnded && band.fromEtaIso === null);
  if (incompleteBands.length > 0) {
    warnings.push(`시작일이 없는 구간이 있어 해당 구간은 선박 ETA 매칭에서 제외됩니다: ${incompleteBands.map((b) => b.label).join(", ")}`);
  }

  if (warnings.length > 0) {
    analysis = { ...analysis, uncertainties: Array.from(new Set([...analysis.uncertainties, ...warnings])) };
  }

  return { analysis, warnings };
}
