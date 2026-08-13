type SimulationEventKind = "NEWS" | "RTA" | "NOISE" | "VESSEL";

/** 노이즈 필터 사유 — AI 자유 서술(exclusionReason)과 별개로 코드가 결정론적으로 분류. */
export type NoiseFilterReason = "PORT_MISMATCH" | "TIME_WINDOW_MISMATCH" | "CAUSE_NOT_OPERATIONAL";

export interface SimulationEventPayload {
  title: string;
  subtitle: string;
  body: string;
  source: string;
}

export interface SimulationVesselEvent {
  vesselId: string;
  status: "SAILING" | "WAITING" | "BERTHED" | "CARGO_OPERATION" | "COMPLETED";
}

export interface SimulationEvent {
  eventId: string;
  /** 같은 사건(항만 장애)의 NEWS와 RTA가 공유하는 id — RTA가 새 사건을 만들지 않고 기존 사건을 갱신하는 데 쓴다. NOISE/VESSEL은 null. */
  incidentId: string | null;
  /** incidentStore에서 사건을 찾는 항만 코드. NOISE/VESSEL은 null. */
  portCode: string | null;
  portName: string | null;
  /** KST 벽시계 기준 ISO(+09:00 명시) — 브라우저 로컬 타임존과 무관하게 항상 같은 절대 시각을 가리킨다. */
  atIso: string;
  atMs: number;
  sourceType: SimulationEventKind;
  /** "다음 이벤트" 버튼과 이벤트 로그에 쓰는 짧은 라벨. */
  label: string;
  /** true면 발생 시 시계를 자동 정지하고 판단 배너를 띄운다(관련 뉴스/RTA). false면 로그만 남기고 계속 진행(노이즈/선박 상태). */
  pauseOnTrigger: boolean;
  /** NEWS/RTA/NOISE 전용(Claude 분석 대상 원문). VESSEL은 없다. */
  payload?: SimulationEventPayload;
  /** VESSEL 전용(선박 상태만 갱신, Claude 호출 없음). */
  vesselEvent?: SimulationVesselEvent;
  /** NOISE 전용. 항만명·시점·사유유형 중 무엇으로 걸렀는지 결정론적으로 명시. */
  filteredBy?: NoiseFilterReason;
  /** filteredBy에 대응하는 사람이 읽을 수 있는 판정 이유 — 뉴스 목록 카드에 그대로 노출한다. */
  filterReason?: string;
}

function toEvent(input: Omit<SimulationEvent, "atMs">): SimulationEvent {
  return { ...input, atMs: new Date(input.atIso).getTime() };
}

const SIMULATION_START_ISO = "2026-09-01T20:00:00+09:00";
export const SIMULATION_START_MS = new Date(SIMULATION_START_ISO).getTime();

export const SOUTHAMPTON_CRANE_INCIDENT_ID = "incident-sou-crane-2026-09";
const SINGAPORE_TYPHOON_INCIDENT_ID = "incident-sgp-typhoon-2026-10";
const ROTTERDAM_STRIKE_INCIDENT_ID = "incident-rtm-strike-2026-11";

/** 전체 시뮬레이션 이벤트. atMs 기준으로 정렬되며 등록 순서는 실행 순서에 영향 없음. */
export const SIMULATION_EVENTS: SimulationEvent[] = [
  // ── 1막 — 사우샘프턴 ──────────────────────────────────────────────
  toEvent({
    eventId: "E-01",
    incidentId: SOUTHAMPTON_CRANE_INCIDENT_ID,
    portCode: "GBSOU",
    portName: "Southampton",
    atIso: "2026-09-02T09:00:00+09:00",
    sourceType: "NEWS",
    label: "[뉴스] 사우샘프턴 크레인 고장",
    pauseOnTrigger: true,
    payload: {
      title: "英 사우샘프턴항 크레인 고장… \"정상화까지 하루 남짓\"",
      subtitle: "",
      source: "로이드 마리타임 데일리",
      body: [
        "영국 남부 최대 자동차 수출입 관문인 사우샘프턴항에서 하역 장비 고장으로 선박 처리에 차질이 발생하고 있다.",
        "항만 운영사 ABP Southampton은 2일 오전, 4번 선석에 배치된 갠트리 크레인 2기 중 1기의 구동부에 이상이 발견되어 가동을 중단했다고 밝혔다. 운영사 측은 부품을 해외에서 조달해야 하는 상황이나, 재고 확보에는 문제가 없다고 설명했다.",
        "사우샘프턴항은 연간 90만 대 이상의 완성차를 처리하는 유럽 주요 자동차 물류 거점으로, 아시아발 자동차운반선의 유럽 첫 기항지로 이용되는 경우가 많다. 크레인 1기가 멈추면서 해당 선석의 하역 처리율은 절반 수준으로 떨어진 것으로 알려졌다.",
        "현지 업계 관계자는 \"부품 수급과 교체 작업, 이후 적체 해소까지 감안하면 24시간 안팎의 지연이 예상된다\"고 말했다.",
        "ABP Southampton은 입항 예정 선사에 순차적으로 개별 통보를 진행하겠다고 밝혔다.",
      ].join("\n\n"),
    },
  }),
  toEvent({
    eventId: "N-01",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-09-03T08:00:00+09:00",
    sourceType: "NOISE",
    label: "[노이즈] LA·롱비치 야드 혼잡",
    pauseOnTrigger: false,
    filteredBy: "PORT_MISMATCH",
    filterReason: "로스앤젤레스는 운항 중인 5척의 기항 스케줄에 포함되지 않음 · 걸러낸 조건: 항만명",
    payload: {
      title: "로스앤젤레스·롱비치항 야드 혼잡 심화",
      subtitle: "미국 서안 컨테이너 물류 이슈, 자동차운반선 항로와는 무관",
      body: "미국 서안 로스앤젤레스·롱비치항의 야드 점유율이 8월 말 기준 88%까지 상승했다. 내륙 운송 연계 지연이 누적된 결과로, 현지 터미널들은 반출 대기 화물 처리에 우선순위를 두고 있다. 선사들은 접안 대기 시간이 평균 하루 이상 늘어난 것으로 보고 있다.",
      source: "북미 항만물류 브리핑",
    },
  }),
  toEvent({
    eventId: "N-02",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-09-08T06:00:00+09:00",
    sourceType: "NOISE",
    label: "[노이즈] 상하이 짙은 안개",
    pauseOnTrigger: false,
    filteredBy: "TIME_WINDOW_MISMATCH",
    filterReason:
      "상하이는 D선의 출발항이나 출항 예정이 10/1로, 이 뉴스의 영향 기간(9/8 당일)과 겹치지 않음 · 걸러낸 조건: 시점",
    payload: {
      title: "상하이 황푸강 짙은 안개, 통항 제한",
      subtitle: "당일 국지적 기상 현상, 우리 선단 출항 일정과는 시점이 어긋남",
      body: "상하이 일대에 짙은 안개가 발생해 황푸강 구간 통항이 일시 제한됐다. 해사국은 시정이 500미터 이하로 떨어짐에 따라 야간 도선을 중단한다고 밝혔다. 정상화는 당일 오후로 예상된다.",
      source: "상하이 해사국",
    },
  }),
  toEvent({
    eventId: "N-03",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-09-14T11:00:00+09:00",
    sourceType: "NOISE",
    label: "[노이즈] 파나마 운하 흘수 제한",
    pauseOnTrigger: false,
    filteredBy: "PORT_MISMATCH",
    filterReason: "5척 모두 파나마 운하를 경유하지 않음 — 아시아·유럽 항로, 수에즈 경유 · 걸러낸 조건: 항만명",
    payload: {
      title: "파나마 운하 흘수 제한 강화",
      subtitle: "중미 항로 인프라 이슈, 아시아·유럽 항로와는 무관",
      body: "파나마 운하청은 가툰호 수위 저하에 대응해 통항 선박의 최대 흘수를 기존 대비 0.3미터 낮추기로 했다. 대형 선박의 적재량 조정이 불가피할 전망이다.",
      source: "중남미 해운 리포트",
    },
  }),
  toEvent({
    eventId: "N-04",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-09-21T07:00:00+09:00",
    sourceType: "NOISE",
    label: "[노이즈] 부산 태풍 대비 하역 중단",
    pauseOnTrigger: false,
    filteredBy: "TIME_WINDOW_MISMATCH",
    filterReason:
      "부산은 C선의 출발항이나 출항 예정이 10/2로, 이 뉴스의 영향 기간(9/21 당일)과 겹치지 않음 · 걸러낸 조건: 시점",
    payload: {
      title: "부산항 태풍 대비 하역 일시 중단",
      subtitle: "당일 기상 대응 조치, 우리 선단 출항 일정과는 시점이 어긋남",
      body: "제12호 태풍의 간접 영향으로 부산항 일부 부두가 하역 작업을 일시 중단했다. 항만공사는 강풍 경보 해제 시까지 크레인 가동을 멈춘다고 밝혔다. 오후 늦게 재개될 것으로 보인다.",
      source: "부산항만공사",
    },
  }),
  toEvent({
    eventId: "R-01",
    incidentId: SOUTHAMPTON_CRANE_INCIDENT_ID,
    portCode: "GBSOU",
    portName: "Southampton",
    atIso: "2026-09-25T02:00:00+09:00",
    sourceType: "RTA",
    label: "[RTA] 사우샘프턴 RTA 통보",
    pauseOnTrigger: true,
    payload: {
      title: "RTA 통보 · SOU-2026-0925-029",
      subtitle: "ABP Southampton -- Berth Planning",
      source: "ABP Southampton",
      body: `================================================================
  RTA NOTICE                       REF : SOU-2026-0925-029
================================================================
  발신    ABP Southampton -- Berth Planning
  수신    입항 예정 PCTC 전선 및 선사 대리점
  시각    2026-09-25  02:00
----------------------------------------------------------------
  사건    4번 선석 갠트리 크레인 구동부 고장 (09/02 발생)
          부품 교체 완료, 처리 적체 해소 진행 중

  영향    자동차 전용 선석 하역 처리율 저하 잔존

  접안 슬롯 조정   [기존 배정 ETA 기준]
          09/26 ~ 09/28 입항   + 24 시간
          09/29 ~ 09/30 입항   + 14 시간
          10/01 이후 입항      조정 없음

  해제 예상   10/01  06:00
  다음 통보   09/27  02:00
================================================================`,
    },
  }),
  // R-01 확정(+24h) 기준 실제 접안 시각 — 3막(D/E)의 V-15/V-17, 2막(B/C)의 V-09/V-10과 같은 패턴으로
  // 접안 시점 자체를 로그에 남긴다. 이게 없으면 GLOVIS-A는 1막 이후 상태가 영원히 "항해 중"에
  // 머무른다(운항 상태를 갱신하는 유일한 통로가 VESSEL 이벤트라서).
  toEvent({
    eventId: "V-07",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-09-28T02:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-A 사우샘프턴 접안",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-A", status: "BERTHED" },
  }),
  toEvent({
    eventId: "V-07b",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-09-28T20:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-A 사우샘프턴 출항",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-A", status: "SAILING" },
  }),
  toEvent({
    eventId: "V-08",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-09-30T08:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-A 브레머하펜 접안",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-A", status: "BERTHED" },
  }),
  toEvent({
    eventId: "V-08b",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-01T06:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-A 하역 완료",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-A", status: "COMPLETED" },
  }),
  toEvent({
    eventId: "V-B1",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-01T08:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-B 상하이 출항",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-B", status: "SAILING" },
  }),
  toEvent({
    eventId: "V-C1",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-02T08:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-C 부산 출항",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-C", status: "SAILING" },
  }),

  // ── 2막 — 싱가포르 ────────────────────────────────────────────────
  toEvent({
    eventId: "E-02",
    incidentId: SINGAPORE_TYPHOON_INCIDENT_ID,
    portCode: "SGSIN",
    portName: "Singapore",
    atIso: "2026-10-02T14:00:00+09:00",
    sourceType: "NEWS",
    label: "[뉴스] 싱가포르 태풍",
    pauseOnTrigger: true,
    payload: {
      title: "싱가포르 해협 태풍 북상… 항만 운영 중단, 16시간 지연 전망",
      subtitle: "",
      source: "아시아 해운물류신문",
      body: [
        "싱가포르 해협 일대로 태풍이 북상하면서 항만 운영에 비상이 걸렸다.",
        "싱가포르 기상청은 2일 오후 해상 강풍 및 폭우 경보를 발령했다. 최대순간풍속은 초속 27미터까지 관측되고 있으며, 시정도 크게 떨어진 상태다.",
        "이에 따라 PSA 싱가포르는 일부 터미널의 크레인 가동을 중단하고 도선 업무를 순차 축소하기로 했다. 파시르판장 자동차 전용 터미널도 오후부터 하역 작업을 멈춘 것으로 확인됐다.",
        "싱가포르항은 아시아와 유럽을 잇는 항로의 핵심 중간 기항지로, 하루 평균 수백 척의 선박이 드나든다. 항만 운영이 중단되면 그 여파는 곧바로 후속 일정에 누적된다.",
        "태풍의 이동 속도가 빨라 3일 중 경보가 해제될 것으로 예보된 가운데, 현지 물류업계는 \"대기 선박 적체까지 감안하면 16시간 안팎의 지연이 예상된다\"고 전망했다.",
        "PSA 측은 기상 추이를 지켜보며 선석 배정을 재조정하겠다고 밝혔다.",
      ].join("\n\n"),
    },
  }),
  toEvent({
    eventId: "R-02",
    incidentId: SINGAPORE_TYPHOON_INCIDENT_ID,
    portCode: "SGSIN",
    portName: "Singapore",
    atIso: "2026-10-05T07:00:00+09:00",
    sourceType: "RTA",
    label: "[RTA] 싱가포르 RTA 통보",
    pauseOnTrigger: true,
    payload: {
      title: "RTA 통보 · SIN-2026-1005-055",
      subtitle: "PSA Singapore -- Vessel Traffic & Berthing",
      source: "PSA Singapore",
      body: `================================================================
  RTA NOTICE                       REF : SIN-2026-1005-055
================================================================
  발신    PSA Singapore -- Vessel Traffic & Berthing
  수신    입항 예정 PCTC 전선 및 선사 대리점
  시각    2026-10-05  07:00
----------------------------------------------------------------
  사건    태풍 통과 (10/03 18:00 경보 해제)
          대기 선박 적체 해소 진행 중

  영향    파시르판장 자동차 터미널 처리 지연 잔존

  접안 슬롯 조정   [기존 배정 ETA 기준]
          10/06 ~ 10/09 입항   + 16 시간
          10/10 ~ 10/11 입항   +  5 시간
          10/12 이후 입항      조정 없음

  다음 통보   10/06  07:00
================================================================`,
    },
  }),
  // 싱가포르 접안 시점을 로그에 남김 — 없으면 V-11/V-12(10/30)까지 선박이 순간이동한 것처럼 보임.
  toEvent({
    eventId: "V-09",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-07T23:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-B 싱가포르 접안",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-B", status: "BERTHED" },
  }),
  toEvent({
    eventId: "V-09b",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-08T12:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-B 싱가포르 출항",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-B", status: "SAILING" },
  }),
  toEvent({
    eventId: "V-10",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-09T03:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-C 싱가포르 접안",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-C", status: "BERTHED" },
  }),
  toEvent({
    eventId: "V-10b",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-09T23:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-C 싱가포르 출항",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-C", status: "SAILING" },
  }),
  toEvent({
    eventId: "E-02-NOISE",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-03T09:00:00+09:00",
    sourceType: "NOISE",
    label: "[노이즈] 싱가포르 크루즈 터미널 방문객 증가",
    pauseOnTrigger: false,
    payload: {
      title: "싱가포르 크루즈 터미널, 연휴 방문객 증가로 붐벼",
      subtitle: "화물 운항과는 무관한 관광 수요 기사",
      body: "싱가포르 크루즈 터미널은 연휴를 맞아 방문객이 늘며 붐비고 있다. 화물 하역이나 접안 일정에는 영향이 없는 것으로 알려졌다.",
      source: "싱가포르 관광청",
    },
  }),
  toEvent({
    eventId: "N-05",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-08T18:00:00+09:00",
    sourceType: "NOISE",
    label: "[노이즈] 함부르크 예선사 파업",
    pauseOnTrigger: false,
    filteredBy: "PORT_MISMATCH",
    filterReason: "함부르크는 기항 스케줄에 없음. 브레머하펜(C선 목적지)과 인접하나 별개 항만 · 걸러낸 조건: 항만명",
    payload: {
      title: "함부르크항 예선사 부분 파업",
      subtitle: "화물 운항과는 무관한 지역 인력 이슈",
      body: "함부르크항의 예선(터그보트) 운영사 일부가 임금 협상 관련 부분 파업에 들어갔다. 자동차 전용 터미널 운영에는 영향이 없는 것으로 알려졌다.",
      source: "북유럽 항만물류 브리핑",
    },
  }),
  toEvent({
    eventId: "N-09",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-12T09:00:00+09:00",
    sourceType: "NOISE",
    label: "[노이즈] 콜롬보 혼잡",
    pauseOnTrigger: false,
    filteredBy: "PORT_MISMATCH",
    filterReason: "항로상 인접하나 기항 없음 · 걸러낸 조건: 항만명",
    payload: {
      title: "콜롬보항 컨테이너 처리 혼잡 심화",
      subtitle: "자동차 전용 선박 항로와는 무관",
      body: "스리랑카 콜롬보항이 컨테이너 물동량 증가로 혼잡을 겪고 있다. 자동차 전용 터미널 및 관련 항로에는 영향이 없는 것으로 확인됐다.",
      source: "남아시아 물류 리포트",
    },
  }),
  toEvent({
    eventId: "N-06",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-15T09:00:00+09:00",
    sourceType: "NOISE",
    label: "[노이즈] 수에즈 통항료 인상",
    pauseOnTrigger: false,
    filteredBy: "CAUSE_NOT_OPERATIONAL",
    filterReason:
      "5척 전부가 실제로 통과하는 구간이지만, 접안 시각에 영향을 주지 않음. 사유 유형 분류에서 스케줄 교란 이벤트가 아닌 것으로 판정 · 걸러낸 조건: 사유 유형",
    payload: {
      title: "수에즈 운하 통항료 내년 인상 예고",
      subtitle: "운임 관련 일반 경제 기사",
      body: "수에즈운하관리청(SCA)이 내년도 통항료 인상 계획을 발표했다. 이번 시연 대상 항차의 접안·하역 일정에는 직접적인 영향이 없다.",
      source: "글로벌 해운 경제",
    },
  }),
  toEvent({
    eventId: "V-11",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-30T16:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-B 제브뤼헤 접안",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-B", status: "BERTHED" },
  }),
  toEvent({
    eventId: "V-11b",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-31T06:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-B 하역 완료",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-B", status: "COMPLETED" },
  }),
  toEvent({
    eventId: "V-12",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-30T17:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-C 브레머하펜 접안",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-C", status: "BERTHED" },
  }),
  toEvent({
    eventId: "V-12b",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-31T07:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-C 하역 완료",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-C", status: "COMPLETED" },
  }),

  // ── 3막 — 로테르담 ────────────────────────────────────────────────
  toEvent({
    eventId: "V-13",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-10-31T12:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-D 상하이 출항",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-D", status: "SAILING" },
  }),
  toEvent({
    eventId: "V-14",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-11-03T09:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-E 상하이 출항",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-E", status: "SAILING" },
  }),
  toEvent({
    eventId: "E-03",
    incidentId: ROTTERDAM_STRIKE_INCIDENT_ID,
    portCode: "NLRTM",
    portName: "Rotterdam",
    atIso: "2026-11-04T10:00:00+09:00",
    sourceType: "NEWS",
    label: "[뉴스] 로테르담 파업",
    pauseOnTrigger: true,
    payload: {
      title: "로테르담항 항만노조 파업 돌입… \"이르면 이틀 내 정상화\"",
      subtitle: "",
      source: "유럽 물류 위클리",
      body: [
        "유럽 최대 항만인 네덜란드 로테르담항에서 항만 노동자들이 파업에 들어갔다.",
        "네덜란드 운수노조 FNV Havens는 4일 오전 6시를 기해 로테르담항 주요 터미널에서 전면 파업에 돌입했다고 밝혔다. 임금 인상률과 교대 근무 체계 개편을 놓고 진행된 교섭이 지난주 결렬된 데 따른 것이다.",
        "파업에는 컨테이너 터미널뿐 아니라 자동차 전용 터미널 인력도 상당수 참여한 것으로 알려졌다. 항만 관계자에 따르면 4일 오전 기준 하역 작업은 사실상 중단된 상태다.",
        "로테르담항은 연간 1,400만 TEU 이상을 처리하는 유럽 물류의 관문이다. 파업이 장기화될 경우 그 여파는 인근 안트베르펀, 제브뤼헤 등으로 확산될 가능성도 제기된다.",
        "항만공사는 조속한 교섭 재개를 목표로 하고 있다고 밝혔다. 현지 언론은 과거 사례에 비춰 \"파업이 이르면 이틀 내 마무리되고, 입항 선박 기준 26시간 안팎의 지연이 예상된다\"고 전했다.",
        "다만 파업이 길어질 경우 적체 규모는 크게 달라질 수 있다는 관측도 함께 나온다. 유럽으로 완성차를 수송 중인 자동차운반선들의 일정 조정이 불가피할 전망이다.",
      ].join("\n\n"),
    },
  }),
  toEvent({
    eventId: "N-07",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-11-04T16:00:00+09:00",
    sourceType: "NOISE",
    label: "[노이즈] 안트베르펀 세관 장애",
    pauseOnTrigger: false,
    filteredBy: "PORT_MISMATCH",
    filterReason: "안트베르펀은 기항 스케줄에 없음. 제브뤼헤·로테르담과 인접하나 별개 항만 · 걸러낸 조건: 항만명",
    payload: {
      title: "안트베르펀항 세관 전산망 일시 장애",
      subtitle: "인근 항만 행정 이슈, 로테르담 선석과는 무관",
      body: "벨기에 안트베르펀항에서 세관 통관 전산망이 수 시간 장애를 겪었다가 복구됐다. 로테르담항 접안·하역 일정에는 영향이 없는 것으로 확인됐다.",
      source: "베네룩스 물류 뉴스",
    },
  }),
  toEvent({
    eventId: "N-08",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-11-11T10:00:00+09:00",
    sourceType: "NOISE",
    label: "[노이즈] 제벨알리 준설",
    pauseOnTrigger: false,
    filteredBy: "PORT_MISMATCH",
    filterReason: "기항 스케줄에 없음 · 걸러낸 조건: 항만명",
    payload: {
      title: "두바이 제벨알리항, 정기 준설 작업 착수",
      subtitle: "중동 항로 일반 인프라 소식",
      body: "두바이 제벨알리항이 정기 항로 준설 작업에 들어갔다고 밝혔다. 유럽행 자동차운반선 항로 및 로테르담 접안 일정에는 영향이 없다.",
      source: "중동 해운 위클리",
    },
  }),
  toEvent({
    eventId: "N-10",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-11-20T14:00:00+09:00",
    sourceType: "NOISE",
    label: "[노이즈] 르아브르 야드 포화",
    pauseOnTrigger: false,
    filteredBy: "PORT_MISMATCH",
    filterReason: "르아브르는 기항 스케줄에 없음. 로테르담과 인접하나 별개 항만 · 걸러낸 조건: 항만명",
    payload: {
      title: "르아브르항 컨테이너 야드 포화 상태",
      subtitle: "인근 항만 컨테이너 적체, 자동차 터미널과는 무관",
      body: "프랑스 르아브르항의 컨테이너 야드가 포화 상태에 이르렀다는 보도가 나왔다. 로테르담항 자동차 전용 터미널 운영에는 영향이 없는 것으로 알려졌다.",
      source: "서유럽 항만 동향",
    },
  }),
  toEvent({
    eventId: "R-03",
    incidentId: ROTTERDAM_STRIKE_INCIDENT_ID,
    portCode: "NLRTM",
    portName: "Rotterdam",
    atIso: "2026-11-24T06:00:00+09:00",
    sourceType: "RTA",
    label: "[RTA] 로테르담 RTA 통보",
    pauseOnTrigger: true,
    payload: {
      title: "RTA 통보 · RTM-2026-1124-015",
      subtitle: "Port of Rotterdam Authority -- Slot Coordination",
      source: "Port of Rotterdam Authority",
      body: `================================================================
  RTA NOTICE                       REF : RTM-2026-1124-015
================================================================
  발신    Port of Rotterdam Authority -- Slot Coordination
  수신    입항 예정 PCTC 전선 및 선사 대리점
  시각    2026-11-24  06:00
----------------------------------------------------------------
  사건    항만노조 전면 파업
          11/04 06:00 개시 ~ 11/06 12:00 종료 (실적 54시간)
          자동차 전용 터미널 포함 전면 재가동

  영향    파업 기간 누적 백로그
          당초 예상 대비 해소 지연

  접안 슬롯 조정   [기존 배정 ETA 기준]
          11/25 ~ 11/26 입항   + 31 시간
          11/27 ~ 11/28 입항   + 28 시간
          11/29 ~ 11/30 입항   + 18 시간
          12/01 이후 입항      +  8 시간

  산정 근거   파업 실적 54시간 + 자동차 터미널 처리능력
              기준 백로그 해소 곡선

  다음 통보   11/26  06:00
================================================================`,
    },
  }),
  toEvent({
    eventId: "V-15",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-11-27T13:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-D 로테르담 접안",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-D", status: "BERTHED" },
  }),
  toEvent({
    eventId: "V-16",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-11-28T06:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-D 하역 완료",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-D", status: "COMPLETED" },
  }),
  toEvent({
    eventId: "V-17",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-11-29T13:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-E 로테르담 접안",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-E", status: "BERTHED" },
  }),
  toEvent({
    eventId: "V-18",
    incidentId: null,
    portCode: null,
    portName: null,
    atIso: "2026-11-30T11:00:00+09:00",
    sourceType: "VESSEL",
    label: "[선박] GLOVIS-E 하역 완료",
    pauseOnTrigger: false,
    vesselEvent: { vesselId: "GLOVIS-E", status: "COMPLETED" },
  }),
];
