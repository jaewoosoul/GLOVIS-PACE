export type SignalGrade = "긴급" | "운항 기회" | "정상화 신호" | "운항 무관" | "영향 없음";
export type SignalProcessingStatus = "판단 필요" | "자동 제외" | "모니터링" | "처리 완료";

export interface Signal {
  id: string;
  title: string;
  occurredAtLabel: string;
  port: string;
  grade: SignalGrade;
  reason?: string;
  sourceReliability?: "높음" | "중간" | "낮음";
  estimatedDurationHours?: number;
  affectedVesselCount: number;
  processingStatus: SignalProcessingStatus;
  /** true인 신호만 SIGNAL_DETAIL에서 전체 AI 분석·영향 선박 판정을 보여준다 */
  hasFullAnalysis: boolean;
  /** 위험(사건) 대응 감속 신호인지, 기회(선석) 대응 증속 신호인지. 없으면 기존 사건형(PORT_DISRUPTION)으로 간주한다. */
  trigger?: "PORT_DISRUPTION" | "BERTH_SLOT_OPPORTUNITY";
  /**
   * 시뮬레이션 타임라인 이벤트(incidentId 보유)에서 만들어진 신호만 채워진다 — 지금은 모든 신호가
   * 여기서 나오므로 항상 채워지고, "검토"는 항상 incidentStore의 실제 선박별 속도 비교 페이지
   * (/decisions/incident/:id)로 이동한다.
   */
  linkedIncidentId?: string;
}

export type EventType = "파업" | "태풍" | "장비 장애" | "혼잡";
export type EventStatus = "진행 중" | "예상" | "해소됨";
export type SourceReliability = "높음" | "중간" | "낮음";

export interface PortEventNews {
  headline: string;
  body: string;
  evidenceSentence: string;
}

export interface PortEventAiAnalysis {
  port: string;
  terminal: string;
  eventType: EventType;
  status: EventStatus;
  estimatedDurationHours: number;
  sourceReliability: SourceReliability;
  affectedVesselIds: string[];
}

export interface PortEvent {
  id: string;
  news: PortEventNews;
  analysis: PortEventAiAnalysis;
}
