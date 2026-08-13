import type { BerthOpportunity } from "../types/decision";

/**
 * decisionStore의 DRAFT 기본값(delayAssumptionHours/berthCutoffOverrideAt 등)에만 쓰인다.
 * 이 값들을 실제로 읽는 화면(레거시 Singapore/Shanghai 데모 시나리오)은 삭제되었지만,
 * decisionStore의 상태 모양(및 이미 저장된 실행 레코드)과의 호환을 위해 기본값 자체는 남겨둔다.
 */
export const DEFAULT_PORT_DELAY_HOURS = 24;
export const DEFAULT_MIN_ARRIVAL_BUFFER_MINUTES = 45;

export const SHANGHAI_BERTH_OPPORTUNITY: BerthOpportunity = {
  id: "berth-opportunity-shanghai-waigaoqiao",
  portCode: "shanghai",
  terminalName: "Waigaoqiao Automobile Terminal",
  windowStartAt: "08/16 16:30",
  windowEndAt: "08/16 18:00",
  nextAvailableWaitHours: 30,
  confidence: "HIGH",
};
