# 대시보드 설계 — 화면/컴포넌트/상태/계산 모듈 구조

> 이 문서는 현재 저장소의 실제 구조(`frontend/` + `backend/`, React Router 기반 다중 페이지)를 기준으로
> 작성됐다. 계산 엔진·판단 로직은 프런트(`frontend/src/calculations/`)에 순수 함수로 존재하며,
> 백엔드(`backend/`)는 Claude(Anthropic API)를 호출해 뉴스/RTA 문서를 구조화된 분석 결과로 바꾸는
> 역할만 한다 — 실시간 AIS 연동은 없다.

## 1. 리포지토리 구조

```
Gloivs-ship/
├─ frontend/   React 19 + Vite + TS + Tailwind v4 + Zustand + react-router-dom + d3-geo
├─ backend/    Node.js + TypeScript + Express — Claude 뉴스/RTA 분석 API
├─ docs/
├─ package.json (루트, npm --prefix 기반 실행 스크립트)
└─ README.md
```

## 2. 판단 흐름

판단 흐름은 하나뿐이다.

- **실제 사건 시나리오** (`/decisions/incident/:incidentId`) — 시뮬레이션 시계가 재생하는 뉴스
  이벤트를 backend가 Claude로 분석해 사건(Incident)을 만들고, RTA 이벤트가 재생되면 확정 판단으로
  넘어간다. 4옵션(MAINTAIN/SLIGHT/REQUIRED/MIN_SPEED, `types/scenarioDecision.ts`) 모델을 쓰며,
  `incidentOptionAdapter.ts`가 이를 A/B/C/D 표현으로 옮겨 `SlowdownDecisionPage`
  (`components/decision/*` 판단 화면 컴포넌트 + `components/decisions/DecisionOptionCard`)를
  재사용한다. 완료된 판단은 `reportRecordBuilder.ts`가 자동으로 `/reports`에 기록한다.

`decisionStore`/`executionRecordsStore`의 `decisionMode`("SLOW_DOWN"/"SPEED_UP" 유니언)와
증속 전용 필드(`delayAssumptionHours`, `berthCutoffOverrideAt` 등)는 이미 저장된 실행 레코드와의
타입 호환을 위해 상태 모양만 남아 있다 — 지금은 항상 "SLOW_DOWN"만 쓰인다.

GLOVIS 선박(A~E)의 위치는 `frontend/src/data/scenarioVessels.ts`의 실제 스케줄 데이터를 시뮬레이션
시계(`simulationStore`)에 따라 보간해서 지도에 표시한다 — 실시간 AIS 데이터는 쓰지 않는다.

## 3. 화면 구조 (라우트)

1. **대시보드** (`/dashboard`, 기본 화면) — KPI 5장(관리 선박/운항 중/항만·정박/운항 판단/실행 중,
   전부 실계산), 최근 움직임 표, 최근 경보 카드(없으면 빈 상태), 최근 운항 결정(없으면 빈 상태).
   큰 세계지도는 여기 없음.
2. **운항 판단 상세** (`/decisions/incident/:incidentId`) — 사건 요약(IncidentRibbon), 속도 옵션
   비교, 일정 도미노, AI 근거 탭, 하단 고정 승인 바.
3. **운항 판단 목록** (`/decisions`) — 실제로 판단이 필요한 사건만 나열(대기열이 비면 빈 상태 문구).
   승인된 판단의 실행 진행 상태(다음 실행 단계 클릭)도 여기서 함께 다룬다 — 별도 `/executions`
   페이지는 없고 `/executions`는 `/decisions`로 리다이렉트된다.
4. **선대 지도** (`/map`) — 전체화면 지도(D3 기반). 97척 시뮬레이션 선대를 마커로 표시하고, GLOVIS
   A~E는 시뮬레이션 시계에 따라 실제로 이동한다("다음 이벤트" 클릭마다 갱신).
5. **뉴스** (`/news`) — 접수된 뉴스와 AI 처리 상태(백엔드 미연동 시 빈 상태만 표시, 하드코딩 없음).
6. **리포트** (`/reports`) — 완료(COMPLETED)된 판단을 모아 보여주고, 개별 판단을 3페이지 PDF로
   내보낸다(1p 사건·AI 판단·선택 방법 / 2p 계산식·경제효과 상세 / 3p 전후 비교 통계).

로그인 화면 없음, RoleSwitcher 같은 역할 전환 UI도 없음(단일 운항 담당자 관점의 데모).

## 4. 프런트엔드 컴포넌트 구조

```
frontend/src/
├─ app/          App.tsx(루트), AppRouter.tsx(라우트 정의), AppShell.tsx(Sidebar+TopHeader+
│                 SimulationClockBar+Outlet 공통 레이아웃)
├─ pages/        라우트 1:1 대응 화면(DashboardPage, FleetMapPage, NewsPage, DecisionQueuePage,
│                 IncidentDecisionPage, ReportPage, + 판단 상세 원본인 SlowdownDecisionPage)
├─ components/
│  ├─ layout/     Sidebar, TopHeader
│  ├─ fleet/      FleetMap(d3-geo 렌더러), MapLegend
│  ├─ signals/    IncidentRibbon, AiEvidenceTab, AiAnalysisPanel, RtaAnalysisPanel
│  ├─ incidents/  IncidentCard
│  ├─ decision/   RecommendationCard, SpeedOptionGrid, ApprovalBar, DetailTabs 등(판단 화면 UI)
│  ├─ decisions/  DecisionOptionCard, DecisionOptionCardGrid(실제 사건 4옵션 UI)
│  ├─ execution/  ExecutionBar, ExecutionProgressTab, DocumentsTab, MonitoringTab 등
│  ├─ report/     DecisionPdfTemplate(3페이지 PDF 레이아웃)
│  ├─ simulation/ SimulationClockBar
│  └─ common/     Badge, StatusBadge, KpiCard, SectionCard, EmptyState, RelativeTime, Modal, Card, PageContainer
├─ calculations/  계산 엔진(§5)
├─ data/          97척 선대, GLOVIS A~E 실제 스케줄, 시뮬레이션 이벤트
├─ stores/        simulationStore, decisionStore, incidentStore, executionRecordsStore,
│                 scenarioVesselStore, workflowStore, alertsStore, newsStore, reportStore
├─ types/         fleet.ts, signal.ts, decision.ts, scenarioDecision.ts, newsAnalysis.ts, rtaAnalysis.ts, report.ts
├─ services/      newsAnalysisClient/newsSubmission, rtaAnalysisClient/rtaSubmission (backend REST 클라이언트)
└─ lib/           format, seededRandom, useCountdown, routeMap, pdfExport
```

판단·경보·뉴스·리포트는 전부 프런트 Zustand 스토어가 단일 소스이며 대부분 `persist` 미들웨어로
localStorage에 저장된다 — 별도 서버 상태 캐시 레이어(TanStack Query 등)는 쓰지 않는다. 서버(백엔드)는
뉴스/RTA 문서를 Claude로 분석해 구조화된 JSON을 반환할 뿐, 판단 계산이나 상태 보관에는 관여하지 않는다.

## 5. 계산 모듈 (`frontend/src/calculations/`)

```
calculations/
├─ commonCalculations.ts          연료소비량(0.1727×V²−0.217×V)·항해시간 공통 공식
├─ slowdownCalculations.ts        일정 도미노(buildScheduleDomino)만 남음 — 4옵션 계산 자체는 삭제됨
├─ scenarioCalculations.ts        필요 속도/접안 대기/연료·CO2 원자 함수(실제 사건 엔진의 기반)
├─ scenarioDecisionCalculations.ts 4옵션(MAINTAIN/SLIGHT/REQUIRED/MIN_SPEED) 계산 + 권고 옵션 선정
├─ incidentOptionAdapter.ts       위 4옵션을 A/B/C/D 표현으로 옮겨 담음
├─ reportRecordBuilder.ts         RTA 확정으로 사건이 COMPLETED되면 리포트 이력을 자동 생성해 reportStore에 push
├─ fleetCalculations.ts           선대 상태 집계(computeFleetStatusSummary) — 선대 생성은 fleetData.ts
├─ fleetSelectors.ts              화면용 훅/셀렉터(useLiveCombinedFleet, KPI 계산)
├─ executionSelectors.ts          승인된 판단(사건 기반)을 실행 요약 목록으로 변환
└─ executionSimulation.ts         실행 클릭 횟수에 따른 진행 상태 계산
```

전부 결정론적 순수 함수다. Claude(백엔드 경유)는 뉴스/RTA 문서에서 어떤 사건이 어느 항만에
얼마나 영향을 주는지 "분석"만 하고, 연료비·CO2·일정 영향 계산에는 전혀 관여하지 않는다 —
계산은 항상 `calculations/`의 결정론적 함수가 담당한다.

## 6. 상태(Zustand) 구조

- **simulationStore** — 가상 시뮬레이션 시계(`currentSimTime`). "다음 이벤트" 클릭으로만 전진하며,
  지도 위 GLOVIS A~E 위치·이벤트 로그가 이 시계를 따라간다.
- **decisionStore** — 화면에 지금 띄운 판단 1건의 승인/실행 상태(싱글턴). `decisionMode`
  ("SLOW_DOWN"만 실제로 쓰임)와 증속 전용 필드는 이미 저장된 실행 레코드와의 호환을 위해
  상태 모양만 남아 있다.
- **incidentStore** — 실제 사건(뉴스 분석 → RTA 확정)별 판단 상태(`provisionalByVessel`,
  `confirmedDelayByVessel`)
- **executionRecordsStore** — (incidentId, vesselId)별 실행 스냅샷. "다음 실행 단계" 클릭으로
  DRAFT→APPROVED→EXECUTING→MONITORING→COMPLETED까지 진행
- **scenarioVesselStore** — GLOVIS 선박별 실제 실행 속도 오버라이드
- **workflowStore** — 판단 세션 컨텍스트(선택된 사건/선박, 지도 포커스)
- **alertsStore** — 판단 대기열. 앱 시작 시 빈 배열이며 뉴스 분석 결과가 "운항 영향 있음"으로
  판정된 사건만 채워진다
- **newsStore** — 제출된 뉴스와 AI 처리 상태. 앱 시작 시 빈 배열
- **reportStore** — 완료된 판단 리포트 이력(`CompletedDecisionRecord[]`), `reportRecordBuilder`가
  다른 스토어의 전환을 구독해 자동으로 채운다

## 7. 데이터 (`frontend/src/data/`)

- `fleetData.ts`: 상세 시나리오 선박 3척(DEMO_DETAIL) + 97척 COMBINED_FLEET(SIMULATED_FLEET).
- `scenarioVessels.ts`: GLOVIS A~E의 실제 운항 스케줄(출항 시각, 원래 배정 ETA, 잔여거리, 기준/최소
  속도, 목적항)과 이를 이용한 지도 진행률 계산 — 실제 사건 판단 엔진(`scenarioDecisionCalculations.ts`)
  및 지도 애니메이션이 공유하는 유일한 진실 소스.
- `simulationEvents.ts`: 가상 시뮬레이션 시계가 "다음 이벤트"마다 재생하는 이벤트 목록(뉴스 발생,
  RTA 수신, 입출항 등).
- `scenarios.ts`: decisionStore의 DRAFT 기본값 몇 개(`DEFAULT_PORT_DELAY_HOURS` 등)만 담은 파일.

## 8. 리포트 / PDF 내보내기

- `reportRecordBuilder.ts`가 `incidentStore`의 사건 COMPLETED 전환(RTA 확정)을 구독해
  `CompletedDecisionRecord`를 만들고 `reportStore`(localStorage 키 `portpace-report-records`)에
  저장한다. 원문 기사·AI 판단·계산식 상세·"뉴스 전 속도 vs RTA 확정 후 속도" 전후 비교까지 함께
  기록된다. RTA 확정 전(뉴스 추정치만으로 승인된 시점)에는 리포트를 만들지 않는다 — 같은 사건이
  두 번 리포트에 뜨는 걸 막기 위함이다.
- `components/report/DecisionPdfTemplate.tsx`가 3페이지 레이아웃(사건·계산식·통계)을 그리고,
  `lib/pdfExport.ts`가 `html2canvas-pro` + `jsPDF`로 화면 캡처 → A4 페이지 분할 PDF를 생성한다.

설계와 구현이 달라지는 경우 본 문서와 `docs/project-structure.md`를 함께 갱신한다.
