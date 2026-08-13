import { useState } from "react";
import { Ship, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge, type BadgeTone } from "../common/Badge";
import { DecisionOptionCardGrid } from "../decisions/DecisionOptionCardGrid";
import { useIncidentStore, type Incident, type VesselConfirmed, type VesselProvisional } from "../../stores/incidentStore";
import { useSimulationStore } from "../../stores/simulationStore";
import { formatIsoLabel as formatIso } from "../../lib/format";

const STATUS_LABEL: Record<Incident["status"], string> = {
  NEWS_ONLY: "뉴스 접수 · 속도 확정 대기",
  DECIDED: "잠정 속도 확정됨 · RTA 대기",
  VERIFIED_UNCHANGED: "RTA 확정 · 추정치와 일치",
  REVIEW_REQUIRED_INCREASED_DELAY: "RTA 확정 · 재검토 필요(지연 증가)",
  REVIEW_REQUIRED_REDUCED_DELAY: "RTA 확정 · 재검토 필요(지연 감소)",
  COMPLETED: "완료된 사건",
};
const STATUS_TONE: Record<Incident["status"], BadgeTone> = {
  NEWS_ONLY: "yellow",
  DECIDED: "blue",
  VERIFIED_UNCHANGED: "green",
  REVIEW_REQUIRED_INCREASED_DELAY: "red",
  REVIEW_REQUIRED_REDUCED_DELAY: "orange",
  COMPLETED: "green",
};

/**
 * NEWS(추정)와 RTA(확정)를 같은 사건 아래 나란히 비교해서 보여주는 카드(§12 운항 판단 카드 UI).
 * /news 페이지의 "운항 판단 비교" 섹션에서 incidentStore.incidents를 그대로 순회해 렌더링한다.
 */
export function IncidentCard({ incident }: { incident: Incident }) {
  const decideSpeed = useIncidentStore((s) => s.decideSpeed);
  const confirmRevision = useIncidentStore((s) => s.confirmRevision);
  const currentSimTime = useSimulationStore((s) => s.currentSimTime);
  const [selectedByVessel, setSelectedByVessel] = useState<Record<string, number>>({});

  const vesselCount = incident.rtaAnalysis ? incident.confirmedDelayByVessel.length : incident.provisionalByVessel.length;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-sm font-semibold text-gray-800">{incident.portName} 사건 — 운항 판단</span>
          <p className="text-xs text-gray-400">영향 항차 {vesselCount}척</p>
        </div>
        <Badge tone={STATUS_TONE[incident.status]}>{STATUS_LABEL[incident.status]}</Badge>
      </div>

      {/* NEWS/RTA 비교 헤더 */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-amber-800">
          <Badge tone="yellow">언론 NEWS</Badge>
          {incident.newsReceivedAtIso && formatIso(incident.newsReceivedAtIso)} · AI 추정{" "}
          {incident.provisionalDelayHours !== null ? `${incident.provisionalDelayHours}h` : "정보 없음"}
        </span>
        {incident.rtaAnalysis && incident.rtaReceivedAtIso && (
          <span className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-blue-800">
            <Badge tone="blue">항만 RTA</Badge>
            {formatIso(incident.rtaReceivedAtIso)} · 확정값 선박별 상이 가능
          </span>
        )}
      </div>

      {/* NEWS 단계: 선박별 잠정 판단 */}
      {incident.provisionalByVessel.length > 0 && !incident.rtaAnalysis && (
        <div className="mt-3 space-y-3">
          {incident.provisionalByVessel.map((pv) => (
            <ProvisionalVesselBlock
              key={pv.vesselId}
              vessel={pv}
              decidedSpeedKn={incident.decidedSpeedByVessel[pv.vesselId]}
              selectedSpeedKn={selectedByVessel[pv.vesselId]}
              onSelect={(speed) => setSelectedByVessel((prev) => ({ ...prev, [pv.vesselId]: speed }))}
              onConfirm={(speed) => decideSpeed(incident.incidentId, pv.vesselId, speed, new Date(currentSimTime).toISOString())}
            />
          ))}
        </div>
      )}

      {/* RTA 단계: 선박별 확정 비교 */}
      {incident.rtaAnalysis && (
        <div className="mt-3 space-y-3">
          {incident.confirmedDelayByVessel.map((v) => (
            <ConfirmedVesselBlock
              key={v.vesselId}
              vessel={v}
              provisionalDelayHours={incident.provisionalDelayHours}
              selectedSpeedKn={selectedByVessel[v.vesselId]}
              onSelect={(speed) => setSelectedByVessel((prev) => ({ ...prev, [v.vesselId]: speed }))}
              onConfirm={(speed) => confirmRevision(incident.incidentId, v.vesselId, speed, new Date(currentSimTime).toISOString())}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProvisionalVesselBlock({
  vessel,
  decidedSpeedKn,
  selectedSpeedKn,
  onSelect,
  onConfirm,
}: {
  vessel: VesselProvisional;
  decidedSpeedKn: number | undefined;
  selectedSpeedKn: number | undefined;
  onSelect: (speedKn: number) => void;
  onConfirm: (speedKn: number) => void;
}) {
  const { calculation } = vessel;
  const recommendedSpeed = calculation.options.find((o) => o.isRecommended)?.speedKn ?? calculation.options[0]?.speedKn ?? 0;
  const selected = decidedSpeedKn ?? selectedSpeedKn ?? recommendedSpeed;

  return (
    <div className="rounded-md border border-gray-100 bg-white p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-semibold text-gray-700">
          <Ship size={12} /> {vessel.vesselName}
          <span className="ml-2 font-normal text-gray-400">
            잔여 {calculation.remainingDistanceNm.toFixed(0)}nm · 흡수 한계 {calculation.maxAbsorbableDelayHours.toFixed(1)}h
          </span>
        </span>
        {decidedSpeedKn !== undefined ? (
          <Badge tone="blue">현재 운항속도 {decidedSpeedKn.toFixed(2)}kn로 확정됨</Badge>
        ) : (
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            선택한 속도로 확정
          </button>
        )}
      </div>
      {!calculation.absorbable && (
        <p className="mb-1.5 flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle size={11} /> 감속 하한만으로는 사건 지연을 전부 흡수할 수 없어 정박 대기가 남습니다.
        </p>
      )}
      <DecisionOptionCardGrid
        options={calculation.options}
        selectedSpeedKn={selected}
        onSelect={decidedSpeedKn === undefined ? onSelect : undefined}
        readOnly={decidedSpeedKn !== undefined}
      />
    </div>
  );
}

function ConfirmedVesselBlock({
  vessel,
  provisionalDelayHours,
  selectedSpeedKn,
  onSelect,
  onConfirm,
}: {
  vessel: VesselConfirmed;
  provisionalDelayHours: number | null;
  selectedSpeedKn: number | undefined;
  onSelect: (speedKn: number) => void;
  onConfirm: (speedKn: number) => void;
}) {
  if (vessel.comparisonStatus === "UNMATCHED") {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-2.5 text-xs">
        <span className="font-semibold text-gray-700">{vessel.vesselName}</span>
        <p className="mt-1 text-gray-500">기존 배정 ETA({formatIso(vessel.originalAssignedEtaIso)})가 RTA의 접안 슬롯 조정 구간과 매칭되지 않았습니다.</p>
      </div>
    );
  }

  if (vessel.comparisonStatus === "VERIFIED_UNCHANGED") {
    const recalculated = vessel.revision;
    const recommendedSpeed = recalculated?.options.find((o) => o.isRecommended)?.speedKn ?? vessel.priorSpeedKn;
    const selected = selectedSpeedKn ?? recommendedSpeed;

    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 font-semibold text-gray-700">
            <Ship size={12} /> {vessel.vesselName}
          </span>
          {vessel.revisionConfirmed ? (
            <span className="flex items-center gap-1 font-medium text-emerald-700">
              <CheckCircle2 size={12} /> 현재 운항속도 {vessel.priorSpeedKn.toFixed(2)}kn로 확정됨
            </span>
          ) : (
            <span className="flex items-center gap-1 font-medium text-emerald-700">
              <CheckCircle2 size={12} /> 항만 확정치가 뉴스 추정치와 일치합니다
            </span>
          )}
        </div>
        <p className="mt-1 text-emerald-700">
          추정 {provisionalDelayHours}h = 확정 {vessel.confirmedDelayHours}h → 현재 운항속도 {vessel.priorSpeedKn.toFixed(2)}kn 유지
        </p>
        {recalculated && !vessel.revisionConfirmed && (
          <>
            <div className="mt-2">
              <DecisionOptionCardGrid options={recalculated.options} selectedSpeedKn={selected} onSelect={onSelect} />
            </div>
            <button
              type="button"
              onClick={() => onConfirm(selected)}
              className="mt-2 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
            >
              선택한 속도로 확정
            </button>
          </>
        )}
      </div>
    );
  }

  const increased = vessel.comparisonStatus === "REVIEW_REQUIRED_INCREASED_DELAY";
  const diff = provisionalDelayHours !== null && vessel.confirmedDelayHours !== null ? Math.abs(vessel.confirmedDelayHours - provisionalDelayHours) : null;
  const recalculated = vessel.revision;
  const recommendedSpeed = recalculated?.options.find((o) => o.isRecommended)?.speedKn ?? recalculated?.options[0]?.speedKn ?? vessel.priorSpeedKn;
  const selected = selectedSpeedKn ?? recommendedSpeed;

  return (
    <div className={`rounded-md border p-2.5 text-xs ${increased ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 font-semibold text-gray-700">
          <Ship size={12} /> {vessel.vesselName}
        </span>
        {vessel.revisionConfirmed ? (
          <span className="flex items-center gap-1 font-medium text-emerald-700">
            <CheckCircle2 size={12} /> 재계산 속도 {vessel.priorSpeedKn.toFixed(2)}kn로 확정됨
          </span>
        ) : (
          <span className={`flex items-center gap-1 font-medium ${increased ? "text-red-700" : "text-orange-700"}`}>
            {increased ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            재검토 필요 · 지연 {increased ? "증가" : "감소"}
          </span>
        )}
      </div>
      <p className={`mt-1 ${increased ? "text-red-700" : "text-orange-700"}`}>
        추정 {provisionalDelayHours}h → 확정 {vessel.confirmedDelayHours}h ({increased ? "+" : "-"}
        {diff}h)
      </p>
      {recalculated && !vessel.revisionConfirmed && (
        <>
          <p className={`mt-0.5 ${increased ? "text-red-700" : "text-orange-700"}`}>
            변경 전 속도 {vessel.priorSpeedKn.toFixed(2)}kn → 재계산 권장 {recommendedSpeed.toFixed(2)}kn
          </p>
          <div className="mt-2">
            <DecisionOptionCardGrid options={recalculated.options} selectedSpeedKn={selected} onSelect={onSelect} />
          </div>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="mt-2 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
          >
            선택한 속도로 재확정
          </button>
        </>
      )}
    </div>
  );
}
