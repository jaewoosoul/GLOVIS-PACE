import type { KnownPort, NewsAnalysis } from "./newsAnalysisSchema.js";

export interface ValidatedArticle {
  title: string;
  content: string;
}

export interface NewsAnalysisValidationResult {
  analysis: NewsAnalysis;
  /** 검증 과정에서 발견해 정정한 내용. analysis.uncertainties에도 병합되지만, 로그용으로 따로 반환한다. */
  warnings: string[];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Claude의 분석 결과를 그대로 신뢰하지 않고 후처리 검증한다(설계 문서 11절).
 * - 근거 문장이 실제 기사 원문에 있는지 확인한다.
 * - 항만 canonicalName/unLocode가 항만 마스터와 일치하는지 확인한다.
 * - 상태 간 교차 규칙(RESOLVED, READY 등)을 확인해 위반 시 안전한 상태로 낮춘다.
 * Claude 결과를 코드가 무조건 임의로 "고쳐서 통과"시키지 않고, 낮춘 이유를 항상
 * uncertainties에 남긴다 — 화면에서 왜 상태가 조정됐는지 추적할 수 있게 하기 위함이다.
 */
export function validateNewsAnalysis(raw: NewsAnalysis, article: ValidatedArticle, knownPorts: KnownPort[]): NewsAnalysisValidationResult {
  const warnings: string[] = [];
  let analysis: NewsAnalysis = raw;

  // 11.1 근거 문장 검사 — 원문에 없는 근거는 제거한다("허위 근거를 조용히 화면에 표시하지 않는다").
  const haystack = normalizeText(`${article.title}\n${article.content}`);
  const verifiedEvidence = analysis.evidence.filter((item) => {
    const found = haystack.includes(normalizeText(item.quote));
    if (!found) warnings.push(`원문에서 확인되지 않은 근거 문장을 제거했습니다: "${item.quote}"`);
    return found;
  });
  if (verifiedEvidence.length !== analysis.evidence.length) {
    analysis = { ...analysis, evidence: verifiedEvidence };
  }

  // 11.2 항만 매칭 검사 — 마스터에 없는 canonicalName/unLocode는 null로 정리한다.
  analysis = {
    ...analysis,
    affectedPorts: analysis.affectedPorts.map((port) => {
      if (!port.canonicalName && !port.unLocode) return port;
      const match = knownPorts.find(
        (kp) => (port.unLocode !== null && kp.unLocode === port.unLocode) || (port.canonicalName !== null && kp.canonicalName.toLowerCase() === port.canonicalName.toLowerCase()),
      );
      if (!match) {
        warnings.push(`항만 마스터와 일치하지 않는 항만 정보를 정리했습니다: "${port.mentionedName}"`);
        return { ...port, canonicalName: null, unLocode: null };
      }
      // 마스터 값으로 정규화한다 — Claude가 canonicalName만 맞고 unLocode 표기가 다른 경우 등을 보정.
      return { ...port, canonicalName: match.canonicalName, unLocode: match.unLocode };
    }),
  };

  // 11.3 교차 필드 검사
  if (analysis.operationalRelevance !== "IRRELEVANT" && analysis.evidence.length === 0) {
    warnings.push("검증된 근거 문장이 없어 판단 준비 상태를 정보 부족으로 낮췄습니다.");
    analysis = { ...analysis, decisionReadiness: "INSUFFICIENT_INFORMATION" };
  }

  if (analysis.decisionReadiness === "READY" && analysis.affectedPorts.length === 0) {
    warnings.push("영향 항만 정보가 없어 판단 준비 상태를 정보 부족으로 낮췄습니다.");
    analysis = { ...analysis, decisionReadiness: "INSUFFICIENT_INFORMATION" };
  }

  const hasTimingInfo =
    analysis.timing.eventStartAt !== null || analysis.timing.reportedDurationHours !== null || analysis.timing.reportedDelayHours !== null;
  if (analysis.decisionReadiness === "READY" && !hasTimingInfo) {
    warnings.push("시간·기간 정보가 없어 판단 준비 상태를 정보 부족으로 낮췄습니다.");
    analysis = { ...analysis, decisionReadiness: "INSUFFICIENT_INFORMATION" };
  }

  if (analysis.eventStatus === "RESOLVED") {
    if (analysis.requiresOperationalReview) {
      warnings.push("사건 상태가 RESOLVED이므로 즉시 검토 필요 여부를 false로 정정했습니다.");
      analysis = { ...analysis, requiresOperationalReview: false };
    }
    if (analysis.decisionReadiness === "READY") {
      warnings.push("사건 상태가 RESOLVED이므로 판단 준비 상태를 운항 영향 없음으로 조정했습니다.");
      analysis = { ...analysis, decisionReadiness: "NO_IMPACT" };
    }
  }

  if (warnings.length > 0) {
    analysis = { ...analysis, uncertainties: Array.from(new Set([...analysis.uncertainties, ...warnings])) };
  }

  return { analysis, warnings };
}
