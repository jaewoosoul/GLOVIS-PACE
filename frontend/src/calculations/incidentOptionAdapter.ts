/**
 * incidentStore(실제 뉴스/RTA 기반, calculateVesselDecision의 4옵션 MAINTAIN/SLIGHT/REQUIRED/MIN_SPEED 모델)의
 * 결과를, 기존 감속 판단 화면(SlowdownDecisionPage 및 그 하위 컴포넌트들)이 기대하는
 * SpeedOptionResult(A/B/C/D 4옵션 모델) 모양으로 변환한다.
 *
 * 두 계산 엔진은 완전히 다른 모델이라 값을 새로 계산하지 않고 그대로 옮겨 담기만 한다 —
 * 원본 계산(calculateVesselDecision)이 유일한 진실 소스이고, 여기서는 화면 재사용을 위한
 * 표현 변환만 한다. calculateVesselDecision의 options[0]은 항상 MAINTAIN(기준)이므로
 * optionId "A"에 대응시킨다(다운스트림에서 baselineOption을 optionId "A"로 찾는 관례와 일치).
 */
import type { DecisionOption, VesselDecisionCalculation } from "../types/scenarioDecision";
import type { RecommendationLevel, SpeedOptionId, SpeedOptionResult } from "../types/decision";
import type { EventStatus, EventType, PortEvent, SourceReliability } from "../types/signal";
import type { Incident } from "../stores/incidentStore";
import type { NewsEventStatus, NewsEventType } from "../types/newsAnalysis";
import { NEGLIGIBLE_DOWNSTREAM_DELAY_HOURS } from "./scenarioDecisionCalculations";

const OPTION_ID_BY_INDEX: SpeedOptionId[] = ["A", "B", "C", "D"];

function resolveRecommendationLevel(option: DecisionOption): RecommendationLevel {
  if (option.downstreamDelayHours > NEGLIGIBLE_DOWNSTREAM_DELAY_HOURS) return "DANGER";
  return option.isRecommended ? "RECOMMENDED" : "NORMAL";
}

export function adaptIncidentOptionsToSpeedOptions(calc: VesselDecisionCalculation): SpeedOptionResult[] {
  const baseSpeedKn = calc.options[0]?.speedKn ?? 0;
  const baseSailingHours = baseSpeedKn > 0 ? calc.remainingDistanceNm / baseSpeedKn : 0;
  const baselineArrivalAtIso = calc.options[0]?.candidateArrivalIso ?? "";

  return calc.options.map((option, index) => {
    const sailingHours = calc.remainingDistanceNm / option.speedKn;
    const arrivalDelayHours = Math.max(0, sailingHours - baseSailingHours);
    // 화면 컴포넌트 대부분이 이 값을 각자 `> 0`으로 비교해 위험/경고를 표시한다 — 시나리오 고정
    // 데이터의 분 단위 오차(§ resolveRecommendationLevel 주석)로 생긴 수십 분짜리 잔여값이 그대로
    // 넘어가면 모든 소비처에서 개별적으로 다시 걸러줘야 한다. 여기서 한 번에 0으로 스냅해 원본을
    // 유일한 진실 소스로 유지한다.
    const decisionCausedDelayHours = option.downstreamDelayHours <= NEGLIGIBLE_DOWNSTREAM_DELAY_HOURS ? 0 : option.downstreamDelayHours;

    return {
      optionId: OPTION_ID_BY_INDEX[index] ?? "D",
      label: option.label,
      speedKnots: option.speedKn,
      sailingHours,
      arrivalDelayHours,
      arrivalAtIso: option.candidateArrivalIso,
      baselineArrivalAtIso,
      anchorageWaitingHours: option.waitHours,
      fuelSavedTons: option.fuelSavedTon,
      fuelCostSavedUsd: option.fuelSavedUsd,
      co2AvoidedTons: option.co2AvoidedTon,
      decisionCausedDelayHours,
      recommendationLevel: resolveRecommendationLevel(option),
    };
  });
}

export function pickIncidentRecommendedOptionId(options: SpeedOptionResult[]): SpeedOptionId {
  return options.find((o) => o.recommendationLevel === "RECOMMENDED")?.optionId ?? "A";
}

export const EVENT_TYPE_MAP: Record<NewsEventType, EventType> = {
  LABOR_STRIKE: "파업",
  TYPHOON: "태풍",
  WEATHER_DISRUPTION: "태풍",
  EQUIPMENT_FAILURE: "장비 장애",
  PORT_CONGESTION: "혼잡",
  BERTH_CLOSURE: "혼잡",
  BERTH_OPENING: "혼잡",
  PORT_CLOSURE: "혼잡",
  PORT_RECOVERY: "혼잡",
  PILOTAGE_DISRUPTION: "혼잡",
  TOWAGE_DISRUPTION: "혼잡",
  OTHER: "혼잡",
};

export const EVENT_STATUS_MAP: Record<NewsEventStatus, EventStatus> = {
  ONGOING: "진행 중",
  CONFIRMED: "진행 중",
  WATCHING: "진행 중",
  UNKNOWN: "진행 중",
  PREDICTED: "예상",
  RUMOR: "예상",
  RECOVERING: "해소됨",
  RESOLVED: "해소됨",
};

function confidenceToReliability(confidence: number): SourceReliability {
  if (confidence >= 0.75) return "높음";
  if (confidence >= 0.4) return "중간";
  return "낮음";
}

/**
 * incidentStore의 Incident(실제 Claude 뉴스 분석 결과)를, 기존 AI 근거 탭/사건 리본이 기대하는
 * PortEvent 모양으로 변환한다. newsTitle은 newsStore의 NewsItem.title — Incident 자체엔
 * 기사 제목이 없어(요약만 있음) 별도로 전달받는다.
 */
export function adaptIncidentToPortEvent(incident: Incident, newsTitle: string): PortEvent {
  const analysis = incident.newsAnalysis;
  const affectedPort = analysis?.affectedPorts[0];
  const evidenceSentence = analysis?.evidence[0]?.quote ?? analysis?.summary ?? "";
  const estimatedDurationHours =
    analysis?.timing.reportedDurationHours?.max ?? analysis?.timing.reportedDurationHours?.min ?? incident.provisionalDelayHours ?? 0;

  return {
    id: incident.incidentId,
    news: {
      headline: newsTitle || incident.portName + " 사건",
      body: analysis?.summary ?? "",
      evidenceSentence,
    },
    analysis: {
      port: incident.portName,
      terminal: affectedPort?.terminal ?? "-",
      eventType: analysis ? EVENT_TYPE_MAP[analysis.eventType] : "혼잡",
      status: analysis ? EVENT_STATUS_MAP[analysis.eventStatus] : "진행 중",
      estimatedDurationHours,
      sourceReliability: analysis ? confidenceToReliability(analysis.confidence) : "중간",
      affectedVesselIds: incident.provisionalByVessel.map((v) => v.vesselId),
    },
  };
}
