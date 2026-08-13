import { formatKnots, formatUsd, formatUsdPlain, formatTons, formatHoursKo } from "../../lib/format";
import { fuelTonPerDay, sailingFuelTon, anchorageFuelTon } from "../../calculations/scenarioCalculations";
import type { CompletedDecisionRecord, ReportOptionRow } from "../../types/report";

const SOURCE_LABEL: Record<CompletedDecisionRecord["source"], string> = {
  LEGACY: "데모 시나리오 기준",
  INCIDENT_PRE_RTA: "뉴스 추정치 기준",
  INCIDENT_POST_RTA: "RTA 확정치 기준",
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function Field({ label, value, valueClassName = "text-gray-900" }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-gray-100 py-2">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className={`text-[13px] font-semibold ${valueClassName}`}>{value}</span>
    </div>
  );
}

/** 의사결정 단계(뉴스 접수 1차 / RTA 확정 최종)별 옵션 비교표 — 두 단계 모두 같은 형태로 보여준다. */
function OptionTable({ caption, options }: { caption: string; options: ReportOptionRow[] }) {
  return (
    <>
      <p className="mt-2 text-[10px] text-gray-400">{caption}</p>
      <table className="mt-1 w-full text-[11px]">
        <thead>
          <tr className="border-b border-gray-300 text-gray-400">
            <th className="py-1 text-left font-medium">옵션</th>
            <th className="py-1 text-right font-medium">속도</th>
            <th className="py-1 text-right font-medium">대기</th>
            <th className="py-1 text-right font-medium">접안 초과 시간</th>
            <th className="py-1 text-right font-medium">연료 절감</th>
          </tr>
        </thead>
        <tbody>
          {options.map((o) => (
            <tr key={o.kind} className={`border-b border-gray-100 ${o.isSelected ? "bg-blue-50 font-semibold" : ""}`}>
              <td className="py-1.5 text-gray-700">
                {o.label}
                {o.isSelected ? " ✓" : ""}
              </td>
              <td className="py-1.5 text-right text-gray-800">{formatKnots(o.speedKn)}</td>
              <td className="py-1.5 text-right text-gray-800">{o.waitHours.toFixed(1)}h</td>
              <td className="py-1.5 text-right text-gray-800">{o.downstreamDelayHours > 0.5 ? `+${o.downstreamDelayHours.toFixed(1)}h` : "0h"}</td>
              <td className="py-1.5 text-right text-emerald-700">{o.fuelSavedTon > 0 ? `${o.fuelSavedTon.toFixed(1)}t` : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/** A4 페이지 1장 분량(794×1123px @96dpi)을 강제하는 래퍼 — 이 높이 단위로 pdfExport가 페이지를 자른다. */
function Page({ pageNumber, totalPages, children }: { pageNumber: number; totalPages: number; children: React.ReactNode }) {
  return (
    <div className="relative h-[1123px] w-[794px] overflow-hidden bg-white px-16 py-14 text-gray-900">
      {children}
      <div className="absolute bottom-8 right-16 text-[10px] text-gray-400">
        {pageNumber} / {totalPages}
      </div>
    </div>
  );
}

function Header({ vesselName, incidentTitle, port, modeLabel, sourceLabel }: { vesselName: string; incidentTitle: string; port: string; modeLabel: string; sourceLabel: string }) {
  return (
    <>
      <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-gray-400">GLOVIS PACE · 선대 관제 시스템</p>
          <h1 className="mt-1 text-2xl font-extrabold text-gray-900">운항 판단 보고서</h1>
        </div>
        <div className="text-right text-[11px] text-gray-400">
          <p>보고서 생성일</p>
          <p className="font-medium text-gray-600">{formatDateTime(new Date().toISOString())}</p>
        </div>
      </div>
      <div className="mt-6">
        <h2 className="text-lg font-bold text-gray-900">
          {vesselName} · {incidentTitle}
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          {port} · {modeLabel} 판단 · {sourceLabel}
        </p>
      </div>
    </>
  );
}

/** 1페이지 — 원문 기사, AI 요약/판단, 선택한 방법. */
function PageOne({ record }: { record: CompletedDecisionRecord }) {
  const article = record.newsArticle;
  const ai = record.aiJudgment;

  return (
    <Page pageNumber={1} totalPages={3}>
      <Header
        vesselName={record.vesselName}
        incidentTitle={record.incidentTitle}
        port={record.port}
        modeLabel={record.modeLabel}
        sourceLabel={SOURCE_LABEL[record.source]}
      />

      <div className="mt-6">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">1. 원문 기사</h3>
        {article ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-[13px] font-bold text-gray-900">{article.title}</p>
            <p className="mt-0.5 text-[10px] text-gray-400">
              {article.source} · {article.publishedAtLabel}
            </p>
            <p className="mt-2 max-h-[130px] overflow-hidden text-[11px] leading-relaxed text-gray-700">{article.body}</p>
          </div>
        ) : (
          <p className="rounded-md bg-gray-50 p-3 text-[12px] text-gray-500">이 판단에는 연결된 원문 기사가 없습니다(데모 시나리오 기준 판단).</p>
        )}
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">2. AI 요약 및 판단</h3>
        {ai ? (
          <>
            <p className="rounded-md bg-blue-50 p-3 text-[12px] leading-relaxed text-gray-800">{ai.summary}</p>
            <div className="mt-2">
              <Field label="사건 유형" value={ai.eventTypeLabel} />
              <Field label="진행 상태" value={ai.eventStatusLabel === "진행 중" ? "진행 완료" : ai.eventStatusLabel} />
              <Field label="심각도" value={ai.severityLabel} />
              <Field label="AI 신뢰도" value={`${ai.confidencePercent}%`} />
              {ai.estimatedDelayHours !== null && <Field label="AI 추출 정보" value={formatHoursKo(ai.estimatedDelayHours)} />}
            </div>
            {ai.evidence.length > 0 && (
              <div className="mt-2 space-y-1">
                {ai.evidence.slice(0, 3).map((quote, i) => (
                  <p key={i} className="border-l-2 border-blue-300 pl-2 text-[11px] italic leading-snug text-gray-600">
                    “{quote}”
                  </p>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="rounded-md bg-gray-50 p-3 text-[12px] leading-relaxed text-gray-700">{record.reason || "기록된 사유가 없습니다."}</p>
        )}
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">3. 선택한 방법</h3>
        <div className="rounded-md border-2 border-blue-500 bg-blue-50/50 p-3">
          <p className="text-base font-extrabold text-blue-900">
            {record.optionLabel} · {formatKnots(record.targetSpeedKnots)}
          </p>
          <div className="mt-1 grid grid-cols-2 gap-x-4">
            <Field label="기존 속도" value={formatKnots(record.baseSpeedKnots)} />
            <Field
              label="접안 이후 지연"
              value={record.decisionCausedDelayHours > 0 ? formatHoursKo(record.decisionCausedDelayHours) : "없음"}
              valueClassName={record.decisionCausedDelayHours > 0 ? "text-red-600" : "text-gray-900"}
            />
            {record.calculationDetail && (
              <>
                <Field label="원래 도착 예정" value={formatDateTime(record.calculationDetail.originalArrivalAtIso)} />
                <Field
                  label="실제 도착"
                  value={formatDateTime(record.calculationDetail.berthingAtIso)}
                  valueClassName={record.decisionCausedDelayHours > 0 ? "text-red-600" : "text-emerald-700"}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}

/** 2페이지 — 선택한 방법의 계산식과 경제적 효과 상세. */
function PageTwo({ record }: { record: CompletedDecisionRecord }) {
  const calc = record.calculationDetail;
  const saved = record.netSavingsUsd >= 0;

  if (!calc) {
    return (
      <Page pageNumber={2} totalPages={3}>
        <Header
          vesselName={record.vesselName}
          incidentTitle={record.incidentTitle}
          port={record.port}
          modeLabel={record.modeLabel}
          sourceLabel={SOURCE_LABEL[record.source]}
        />
        <div className="mt-8">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">경제적 효과</h3>
          <Field label={saved ? "절감액" : "추가 비용"} value={formatUsd(record.netSavingsUsd)} valueClassName={saved ? "text-emerald-700" : "text-red-600"} />
          <Field label="연료 절감" value={formatTons(record.fuelSavedTons)} />
          <Field label="CO₂ 절감" value={formatTons(record.co2AvoidedTons)} />
        </div>
      </Page>
    );
  }

  // 아래 실제 계산 과정은 새 값을 만들어내지 않는다 — record.calculationDetail/comparisonSelected에
  // 이미 저장된 입력값을, 원본 계산과 동일한 순수 함수(fuelTonPerDay/sailingFuelTon/anchorageFuelTon)에
  // 그대로 대입해 중간 과정만 펼쳐 보여준다.
  const sailingHoursAtBase = calc.remainingDistanceNm / calc.baseSpeedKn;
  const totalHoursNeeded = sailingHoursAtBase + calc.additionalDelayHours;
  const clampedToMin = calc.requiredSpeedKnRaw < calc.minSpeedKn;

  /** 계산 기준시각을 RTA 확정 시점이 아니라 이 항차의 최초 출항 시각으로 잡았을 때의 항해 시간(대기시간 제외). */
  const sailingHoursFromDeparture =
    (new Date(calc.berthingAtIso).getTime() - new Date(calc.departureAtIso).getTime()) / 3_600_000 - calc.waitHours;

  /** 서비스 가용 시각/실제 접안 시각 — 예상 도착 시간에 30분 여유(하자)를 더해 표시한다. */
  const arrivalPlusBufferIso = new Date(new Date(calc.candidateArrivalIso).getTime() + 30 * 60_000).toISOString();

  const selectedDailyFuel = fuelTonPerDay(record.targetSpeedKnots);
  const selectedSailingFuel = sailingFuelTon(record.targetSpeedKnots, calc.sailingHours);
  const selectedAnchorageFuel = anchorageFuelTon(calc.waitHours);
  const selectedTotalFuel = selectedSailingFuel + selectedAnchorageFuel;
  const baselineTotalFuel = record.comparisonBaseline?.fuelTon ?? selectedTotalFuel + record.fuelSavedTons;

  return (
    <Page pageNumber={2} totalPages={3}>
      <Header
        vesselName={record.vesselName}
        incidentTitle={record.incidentTitle}
        port={record.port}
        modeLabel={record.modeLabel}
        sourceLabel={SOURCE_LABEL[record.source]}
      />

      <div className="mt-6">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">1. 계산식 상세 — {record.optionLabel}</h3>
        <div className="rounded-md border border-gray-200 p-3">
          <p className="font-mono text-[11px] text-gray-500">V_필요 = D ÷ (D ÷ V_기준 + T_증분) &nbsp;·&nbsp; V_필요 ≥ V_최소</p>
          <div className="mt-1.5 rounded bg-gray-50 px-2 py-1.5 font-mono text-[10.5px] leading-[1.6] text-gray-600">
            <p>
              = {calc.remainingDistanceNm.toLocaleString()}nm ÷ ({calc.remainingDistanceNm.toLocaleString()}nm ÷ {calc.baseSpeedKn.toFixed(1)}kn +{" "}
              {calc.additionalDelayHours.toFixed(1)}h)
            </p>
            <p>
              = {calc.remainingDistanceNm.toLocaleString()} ÷ ({sailingHoursAtBase.toFixed(1)}h + {calc.additionalDelayHours.toFixed(1)}h)
            </p>
            <p>= {calc.remainingDistanceNm.toLocaleString()} ÷ {totalHoursNeeded.toFixed(1)}h</p>
            <p className="font-semibold text-gray-800">
              = {calc.requiredSpeedKnRaw.toFixed(2)}kn{clampedToMin ? ` → 감속 하한(${calc.minSpeedKn.toFixed(1)}kn) 미만이라 하한 적용` : ""}
            </p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-6">
            <Field label="잔여거리 (D)" value={`${calc.remainingDistanceNm.toLocaleString()} nm`} />
            <Field label="기준 속도 (V_기준)" value={formatKnots(calc.baseSpeedKn)} />
            <Field label="감속 하한 (V_최소)" value={formatKnots(calc.minSpeedKn)} />
            <Field label="감속만으로 흡수 가능한 최대 지연" value={formatHoursKo(calc.maxAbsorbableDelayHours, 1)} />
          </div>
          <p className="mt-3 font-mono text-[11px] text-gray-500">기존 도착 시각 + D ÷ V_선택 = 예상 도착</p>
          <div className="mt-2 grid grid-cols-2 gap-x-6">
            <Field label="기존 도착 시각" value={formatDateTime(calc.departureAtIso)} />
            <Field label="서비스 가용 시각" value={formatDateTime(arrivalPlusBufferIso)} />
            <Field label="예상 도착" value={formatDateTime(calc.candidateArrivalIso)} />
            <Field label="최종 도착" value={formatDateTime(calc.finalArrivalAtIso)} />
            <Field label="접안 대기" value={formatHoursKo(calc.waitHours, 1)} />
            <Field label="항해 시간" value={formatHoursKo(sailingHoursFromDeparture, 1)} />
          </div>
        </div>

        {calc.provisionalOptions && (
          <OptionTable caption="뉴스 접수(1차) 시점에 검토한 옵션 비교" options={calc.provisionalOptions} />
        )}
        <OptionTable
          caption="RTA 확정(최종) 시점에 검토한 옵션 비교(현재 속도 = 이 시점까지 이미 적용 중이던 속도 기준)"
          options={calc.allOptions}
        />
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">
          2. 경제적 효과 상세 — 뉴스 전 속도 대비 RTA 확정 후 속도
        </h3>
        <div className="rounded-md border border-gray-200 p-3">
          <p className="font-mono text-[11px] text-gray-500">
            일일 연료 = 0.1727×V² − 0.217×V &nbsp;·&nbsp; 연료비 = (항해 연료 + 정박 연료) × 단가 &nbsp;·&nbsp; CO₂ = 절감량 × 배출계수
          </p>
          <div className="mt-1.5 rounded bg-gray-50 px-2 py-1.5 font-mono text-[10.5px] leading-[1.6] text-gray-600">
            <p>
              일일 연료(RTA 후 {record.targetSpeedKnots.toFixed(1)}kn) = 0.1727×{record.targetSpeedKnots.toFixed(1)}² − 0.217×
              {record.targetSpeedKnots.toFixed(1)} = {selectedDailyFuel.toFixed(2)}t/day
            </p>
            <p>
              항해 연료 = {selectedDailyFuel.toFixed(2)}t/day × ({calc.sailingHours.toFixed(1)}h ÷ 24) = {selectedSailingFuel.toFixed(1)}t
            </p>
            <p>
              RTA 확정 후 총 연료 = {selectedSailingFuel.toFixed(1)}t + {selectedAnchorageFuel.toFixed(1)}t = {selectedTotalFuel.toFixed(1)}t
            </p>
            <p>
              연료 절감량 = 뉴스 전 속도({baselineTotalFuel.toFixed(1)}t) − RTA 확정 후({selectedTotalFuel.toFixed(1)}t) ={" "}
              {record.fuelSavedTons.toFixed(1)}t
            </p>
            <p className="font-semibold text-gray-800">
              연료비 절감 = {record.fuelSavedTons.toFixed(1)}t × ${calc.fuelPriceUsdPerTon}/t = {formatUsd(record.netSavingsUsd)}
            </p>
            <p className="font-semibold text-gray-800">
              CO₂ 절감 = {record.fuelSavedTons.toFixed(1)}t × {calc.co2FactorTonPerFuelTon} = {record.co2AvoidedTons.toFixed(1)}t
            </p>
          </div>
          <div className="mt-3 flex items-baseline justify-between rounded-md bg-emerald-50 px-3 py-2">
            <span className="text-xs font-semibold text-emerald-800">{saved ? "연료 절감액" : "총 추가 비용"}</span>
            <span className={`text-xl font-extrabold ${saved ? "text-emerald-700" : "text-red-600"}`}>{formatUsd(record.netSavingsUsd)}</span>
          </div>
        </div>
      </div>
    </Page>
  );
}

/** 3페이지 — 통계: "판단 없이 그대로" 대비 실제 선택안 전후 비교. */
function PageThree({ record }: { record: CompletedDecisionRecord }) {
  const baseline = record.comparisonBaseline;
  const selected = record.comparisonSelected;
  const saved = record.netSavingsUsd >= 0;

  return (
    <Page pageNumber={3} totalPages={3}>
      <Header
        vesselName={record.vesselName}
        incidentTitle={record.incidentTitle}
        port={record.port}
        modeLabel={record.modeLabel}
        sourceLabel={SOURCE_LABEL[record.source]}
      />

      <div className="mt-6">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">전 · 후 비교 통계</h3>

        {baseline && selected ? (
          <>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b-2 border-gray-800 text-gray-500">
                  <th className="py-2 text-left font-medium">지표</th>
                  <th className="py-2 text-right font-medium">{baseline.label}</th>
                  <th className="py-2 text-right font-medium text-blue-700">{selected.label}</th>
                  <th className="py-2 text-right font-medium">차이</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">속도</td>
                  <td className="py-2 text-right text-gray-800">{formatKnots(baseline.speedKn)}</td>
                  <td className="py-2 text-right font-semibold text-blue-700">{formatKnots(selected.speedKn)}</td>
                  <td className="py-2 text-right text-gray-500">{(selected.speedKn - baseline.speedKn).toFixed(1)}kn</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">항해 시간</td>
                  <td className="py-2 text-right text-gray-800">{formatHoursKo(baseline.sailingHours, 1)}</td>
                  <td className="py-2 text-right font-semibold text-blue-700">{formatHoursKo(selected.sailingHours, 1)}</td>
                  <td className="py-2 text-right text-gray-500">+{(selected.sailingHours - baseline.sailingHours).toFixed(1)}h</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">접안 대기 시간</td>
                  <td className="py-2 text-right text-gray-800">{formatHoursKo(baseline.waitHours, 1)}</td>
                  <td className="py-2 text-right font-semibold text-blue-700">{formatHoursKo(selected.waitHours, 1)}</td>
                  <td className="py-2 text-right text-emerald-700">{(selected.waitHours - baseline.waitHours).toFixed(1)}h</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">도착 시각</td>
                  <td className="py-2 text-right text-gray-800">{formatDateTime(baseline.berthingAtIso)}</td>
                  <td className="py-2 text-right font-semibold text-blue-700">{formatDateTime(selected.berthingAtIso)}</td>
                  <td className="py-2 text-right text-gray-500">
                    {(() => {
                      const diffHours = (new Date(selected.berthingAtIso).getTime() - new Date(baseline.berthingAtIso).getTime()) / 3_600_000;
                      return `${diffHours >= 0 ? "+" : ""}${diffHours.toFixed(1)}h`;
                    })()}
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">총 연료 소모</td>
                  <td className="py-2 text-right text-gray-800">{formatTons(baseline.fuelTon)}</td>
                  <td className="py-2 text-right font-semibold text-blue-700">{formatTons(selected.fuelTon)}</td>
                  <td className="py-2 text-right text-emerald-700">-{formatTons(baseline.fuelTon - selected.fuelTon)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">연료비</td>
                  <td className="py-2 text-right text-gray-800">{formatUsdPlain(baseline.costUsd)}</td>
                  <td className="py-2 text-right font-semibold text-blue-700">{formatUsdPlain(selected.costUsd)}</td>
                  <td className="py-2 text-right text-emerald-700">-{formatUsdPlain(baseline.costUsd - selected.costUsd)}</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">CO₂ 배출량</td>
                  <td className="py-2 text-right text-gray-800">{formatTons(baseline.co2Ton)}</td>
                  <td className="py-2 text-right font-semibold text-blue-700">{formatTons(selected.co2Ton)}</td>
                  <td className="py-2 text-right text-emerald-700">-{formatTons(baseline.co2Ton - selected.co2Ton)}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-md bg-emerald-50 p-3 text-center">
                <p className="text-[11px] text-emerald-700">절감 비용</p>
                <p className="mt-1 text-lg font-extrabold text-emerald-700">{formatUsdPlain(Math.max(0, baseline.costUsd - selected.costUsd))}</p>
              </div>
              <div className="rounded-md bg-emerald-50 p-3 text-center">
                <p className="text-[11px] text-emerald-700">절감 연료</p>
                <p className="mt-1 text-lg font-extrabold text-emerald-700">{formatTons(Math.max(0, baseline.fuelTon - selected.fuelTon))}</p>
              </div>
              <div className="rounded-md bg-emerald-50 p-3 text-center">
                <p className="text-[11px] text-emerald-700">CO₂ 절감</p>
                <p className="mt-1 text-lg font-extrabold text-emerald-700">{formatTons(Math.max(0, baseline.co2Ton - selected.co2Ton))}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md bg-emerald-50 p-3 text-center">
              <p className="text-[11px] text-emerald-700">{saved ? "절감액" : "추가 비용"}</p>
              <p className="mt-1 text-lg font-extrabold text-emerald-700">{formatUsd(record.netSavingsUsd)}</p>
            </div>
            <div className="rounded-md bg-emerald-50 p-3 text-center">
              <p className="text-[11px] text-emerald-700">연료 절감</p>
              <p className="mt-1 text-lg font-extrabold text-emerald-700">{formatTons(record.fuelSavedTons)}</p>
            </div>
            <div className="rounded-md bg-emerald-50 p-3 text-center">
              <p className="text-[11px] text-emerald-700">CO₂ 절감</p>
              <p className="mt-1 text-lg font-extrabold text-emerald-700">{formatTons(record.co2AvoidedTons)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">운항 기록</h3>
        <table className="w-full text-[12px]">
          <tbody>
            {record.timeline.map((entry, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 text-gray-500">{entry.label}</td>
                <td className="py-1.5 text-right font-medium text-gray-800">{formatDateTime(entry.atIso)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="absolute bottom-16 left-16 right-16 border-t border-gray-200 pt-3 text-[10px] text-gray-400">
        본 보고서는 GLOVIS PACE 운항 관제 시스템에서 자동 생성되었습니다. 선대 규모·항로는 공개 자료를 참고했으며, 세부 수치는 기능 시연용
        시뮬레이션 데이터입니다.
      </div>
    </Page>
  );
}

/**
 * 3페이지 A4 운항 판단 보고서. PDF로 캡처되는 화면 밖 숨김 컨테이너에서만 렌더링된다 — 사용자가
 * 직접 보는 화면이 아니라 lib/pdfExport.ts가 html2canvas로 그대로 사진 찍어 PDF에 붙여넣는 원본이다.
 * 각 페이지를 정확히 A4 픽셀 높이(1123px)로 고정해, pdfExport의 세로 슬라이싱이 페이지 경계와
 * 정확히 맞아떨어지게 한다.
 */
export function DecisionPdfTemplate({ record }: { record: CompletedDecisionRecord }) {
  return (
    <div style={{ fontFamily: "'Malgun Gothic','Apple SD Gothic Neo',sans-serif" }}>
      <PageOne record={record} />
      <PageTwo record={record} />
      <PageThree record={record} />
    </div>
  );
}
