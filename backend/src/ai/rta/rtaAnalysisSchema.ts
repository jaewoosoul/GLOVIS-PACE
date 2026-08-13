import { z } from "zod";
import { KnownPortSchema } from "../news/newsAnalysisSchema.js";

/**
 * Claude가 반환해야 하는 RTA(항만 공식 통보) 분석 결과의 스키마.
 * 뉴스와 달리 RTA는 "선박 ETA 구간별 확정 조정시간" 표를 파싱하는 것이 핵심이다.
 * NewsAnalysisSchema와 마찬가지로 (1) zodOutputFormat으로 Claude에 보낼 JSON Schema를 만들고,
 * (2) 응답을 받은 뒤 다시 이 스키마로 검증하는 데 재사용된다.
 */

function isoDateTimeOrNull() {
  return z
    .string()
    .nullable()
    .refine((value) => value === null || (value.length > 0 && !Number.isNaN(Date.parse(value))), {
      message: "ISO 8601 형식의 시각이거나 null이어야 합니다.",
    });
}

/** "10/06 ~ 10/09 입항" 같은 구간 한 줄. fromEtaIso가 시작일, toEtaIso가 끝일(포함) — 없으면(예: "이후") open-ended. */
const RtaEtaBandSchema = z
  .object({
    /** 원문 구간 표기를 그대로 보존한다(예: "09/26 ~ 09/28 입항", "10/12 이후 입항"). */
    label: z.string().min(1),
    fromEtaIso: isoDateTimeOrNull(),
    toEtaIso: isoDateTimeOrNull(),
    /** "이후"처럼 끝이 명시되지 않은 개방형 구간이면 true. */
    isOpenEnded: z.boolean(),
    /** "조정 없음"은 0으로 표현한다. */
    adjustmentHours: z.number().min(0),
  })
  .refine((value) => value.isOpenEnded || value.toEtaIso === null || value.fromEtaIso === null || Date.parse(value.toEtaIso) >= Date.parse(value.fromEtaIso), {
    message: "toEtaIso는 fromEtaIso 이상이어야 합니다(개방형 구간 제외).",
    path: ["toEtaIso"],
  });
const RtaEvidenceItemSchema = z.object({
  quote: z.string().min(1),
  supports: z.array(
    z.enum(["PORT", "REFERENCE_NUMBER", "ISSUED_AT", "ETA_BAND", "ADJUSTMENT_HOURS", "CLEARANCE_TIME", "INCIDENT_LINK"]),
  ),
});

export const RtaAnalysisSchema = z
  .object({
    /** RTA NOTICE 헤더의 REF 값. */
    referenceNumber: z.string().nullable(),
    /** "시각" 필드(통보 발행 시각). */
    issuedAt: isoDateTimeOrNull(),
    /** "발신" 필드. */
    issuer: z.string().nullable(),
    portMentionedName: z.string().min(1),
    portCanonicalName: z.string().nullable(),
    portUnLocode: z.string().nullable(),
    /** "사건" 필드의 요약(원문 재작성이 아니라 핵심만 — 원문 근거는 evidence에 별도 보관). */
    incidentSummary: z.string().min(1),
    /** "해제 예상" 필드. */
    expectedClearanceAt: isoDateTimeOrNull(),
    /** "다음 통보" 필드. */
    nextNoticeAt: isoDateTimeOrNull(),
    etaBands: z.array(RtaEtaBandSchema).min(1),
    evidence: z.array(RtaEvidenceItemSchema).min(1),
    uncertainties: z.array(z.string()),
    confidence: z.number().min(0).max(1),
    analysisSource: z.literal("CLAUDE"),
  })
  .refine((value) => value.etaBands.filter((b) => b.isOpenEnded).length <= 1, {
    message: "개방형(이후) 구간은 최대 1개여야 합니다.",
    path: ["etaBands"],
  });

export type RtaAnalysis = z.infer<typeof RtaAnalysisSchema>;
export { KnownPortSchema };
