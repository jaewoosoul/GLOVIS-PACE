import { z } from "zod";

/**
 * Claude가 반환해야 하는 항만 뉴스 분석 결과의 스키마.
 * 이 스키마는 (1) zodOutputFormat을 통해 Claude에게 보낼 JSON Schema를 생성하고,
 * (2) Claude 응답을 파싱한 뒤 구조적으로 검증하는 데 그대로 재사용된다.
 *
 * refine() 규칙은 JSON Schema 생성 시에는 반영되지 않고(zodOutputFormat은 schema shape만 전송),
 * 응답을 받은 뒤 클라이언트 측 파싱 단계에서만 적용된다 — Claude에게는 시스템 프롬프트로
 * 동일한 규칙을 별도 설명한다.
 */

export const OperationalRelevanceSchema = z.enum(["RELEVANT", "MONITOR", "IRRELEVANT"]);
export const DecisionReadinessSchema = z.enum(["READY", "MONITOR_ONLY", "NO_IMPACT", "INSUFFICIENT_INFORMATION"]);

export const EventTypeSchema = z.enum([
  "LABOR_STRIKE",
  "TYPHOON",
  "PORT_CONGESTION",
  "BERTH_CLOSURE",
  "BERTH_OPENING",
  "EQUIPMENT_FAILURE",
  "PORT_CLOSURE",
  "PORT_RECOVERY",
  "WEATHER_DISRUPTION",
  "PILOTAGE_DISRUPTION",
  "TOWAGE_DISRUPTION",
  "OTHER",
]);

export const EventStatusSchema = z.enum([
  "RUMOR",
  "PREDICTED",
  "WATCHING",
  "CONFIRMED",
  "ONGOING",
  "RECOVERING",
  "RESOLVED",
  "UNKNOWN",
]);

export const SeveritySchema = z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const AffectedOperationSchema = z.enum([
  "BERTHING",
  "CARGO_HANDLING",
  "DEPARTURE",
  "PILOTAGE",
  "TOWAGE",
  "ANCHORAGE",
  "PORT_ENTRY",
  "UNKNOWN",
]);

export const EvidenceSupportSchema = z.enum([
  "OPERATIONAL_RELEVANCE",
  "EVENT_TYPE",
  "EVENT_STATUS",
  "AFFECTED_PORT",
  "AFFECTED_OPERATION",
  "START_TIME",
  "END_TIME",
  "DURATION",
  "DELAY",
  "SEVERITY",
]);

/** ISO 8601 문자열 또는 null만 허용한다 — 빈 문자열/추측값은 후처리 검증에서 다시 걸러진다. */
function isoDateTimeOrNull() {
  return z
    .string()
    .nullable()
    .refine((value) => value === null || (value.length > 0 && !Number.isNaN(Date.parse(value))), {
      message: "ISO 8601 형식의 시각이거나 null이어야 합니다.",
    });
}

const HourRangeSchema = z
  .object({
    min: z.number().min(0),
    max: z.number().min(0).nullable(),
  })
  .nullable()
  .refine((value) => value === null || value.max === null || value.max >= value.min, {
    message: "max는 min 이상이어야 합니다.",
  });

export const KnownPortSchema = z.object({
  canonicalName: z.string(),
  unLocode: z.string(),
  aliases: z.array(z.string()),
  terminals: z.array(z.string()),
  timezone: z.string(),
});
export type KnownPort = z.infer<typeof KnownPortSchema>;

const AffectedPortSchema = z.object({
  mentionedName: z.string().min(1),
  canonicalName: z.string().nullable(),
  unLocode: z.string().nullable(),
  terminal: z.string().nullable(),
  affectedOperations: z.array(AffectedOperationSchema),
});

const TimingSchema = z.object({
  eventStartAt: isoDateTimeOrNull(),
  eventEndAt: isoDateTimeOrNull(),
  timezone: z.string().nullable(),
  reportedDurationHours: HourRangeSchema,
  reportedDelayHours: HourRangeSchema,
});

const EvidenceItemSchema = z.object({
  quote: z.string().min(1),
  supports: z.array(EvidenceSupportSchema),
});

export const NewsAnalysisSchema = z
  .object({
    operationalRelevance: OperationalRelevanceSchema,
    requiresOperationalReview: z.boolean(),
    decisionReadiness: DecisionReadinessSchema,
    eventType: EventTypeSchema,
    eventStatus: EventStatusSchema,
    severity: SeveritySchema,
    affectedPorts: z.array(AffectedPortSchema),
    timing: TimingSchema,
    evidence: z.array(EvidenceItemSchema),
    summary: z.string().min(1),
    uncertainties: z.array(z.string()),
    missingRequiredInformation: z.array(z.string()),
    exclusionReason: z.string().nullable(),
    confidence: z.number().min(0).max(1),
    analysisSource: z.literal("CLAUDE"),
  })
  .refine((value) => value.operationalRelevance !== "IRRELEVANT" || value.requiresOperationalReview === false, {
    message: "operationalRelevance가 IRRELEVANT이면 requiresOperationalReview는 false여야 합니다.",
    path: ["requiresOperationalReview"],
  })
  .refine((value) => value.decisionReadiness !== "NO_IMPACT" || value.requiresOperationalReview === false, {
    message: "decisionReadiness가 NO_IMPACT이면 requiresOperationalReview는 false여야 합니다.",
    path: ["requiresOperationalReview"],
  })
  .refine((value) => value.operationalRelevance === "IRRELEVANT" || value.evidence.length >= 1, {
    message: "운항 관련 뉴스는 최소 1개의 근거 문장이 필요합니다.",
    path: ["evidence"],
  });

export type NewsAnalysis = z.infer<typeof NewsAnalysisSchema>;
