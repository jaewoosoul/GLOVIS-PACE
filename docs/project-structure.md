# 프로젝트 구조 (PORT PACE)

이 저장소는 PORT PACE 프로젝트 하나만 담는다.

```
Gloivs-ship/
├─ frontend/    React + Vite + TypeScript — PORT PACE 대시보드/지도/판단/리포트
├─ backend/     Node.js + TypeScript + Express — Claude(Anthropic) 기반 뉴스/RTA 분석 API
├─ docs/        설계·구조 문서
├─ package.json 루트 실행 스크립트(npm --prefix 기반, workspaces 아님)
├─ .gitignore
└─ README.md
```

## frontend/src

라우팅은 `react-router-dom`(`createBrowserRouter`)을 사용한다. `AppShell`(Sidebar+TopHeader+
시뮬레이션 시계 바)이 레이아웃 라우트이고, 그 아래 페이지들이 각자 독립 URL을 가진다.

| 경로 | 페이지 |
| --- | --- |
| `/dashboard` | `DashboardPage` |
| `/map` | `FleetMapPage` |
| `/news` | `NewsPage` |
| `/decisions` | `DecisionQueuePage` |
| `/decisions/incident/:incidentId` | `IncidentDecisionPage` — 유일한 판단 흐름(뉴스→RTA) |
| `/reports` | `ReportPage` — 완료된 판단 이력 + PDF 내보내기 |
| `/executions` | `/decisions`로 리다이렉트(실행 현황은 판단 대기열/상세에 통합됨) |

```
frontend/src/
├─ app/
│  ├─ App.tsx        앱 루트. reportRecordBuilder 구독자를 최초 1회 로드
│  ├─ AppRouter.tsx  라우트 정의(createBrowserRouter)
│  └─ AppShell.tsx   Sidebar+TopHeader+SimulationClockBar+Outlet 레이아웃
├─ pages/            최상위 화면(모두 *Page 명명, 라우트 1:1 대응)
│  ├─ DashboardPage.tsx           KPI·최근 움직임·최근 경보·최근 결정
│  ├─ FleetMapPage.tsx            전체화면 지도(D3 기반) + compact indicator 오버레이
│  ├─ NewsPage.tsx                접수된 뉴스 목록
│  ├─ DecisionQueuePage.tsx       판단 대기 사건 목록 (alertsStore 기반)
│  ├─ IncidentDecisionPage.tsx    실제 사건(뉴스 분석 → RTA 확정) 판단 화면
│  ├─ ReportPage.tsx              완료된 판단 리포트 목록 + 3페이지 PDF 내보내기
│  └─ SlowdownDecisionPage.tsx    판단 상세 원본(계산·승인·실행 UI 조립)
├─ components/
│  ├─ layout/      Sidebar, TopHeader
│  ├─ fleet/       FleetMap(D3 세계지도), MapLegend
│  ├─ signals/     IncidentRibbon, AiEvidenceTab, AiAnalysisPanel, RtaAnalysisPanel
│  ├─ incidents/   IncidentCard
│  ├─ decision/    판단 화면 UI(RecommendationCard, SpeedOptionGrid, ApprovalBar, DetailTabs 등)
│  ├─ decisions/   실제 사건(incidentStore) 4옵션 카드(DecisionOptionCard, DecisionOptionCardGrid)
│  ├─ execution/   ExecutionBar, ExecutionProgressTab, DocumentsTab, MonitoringTab 등
│  ├─ report/      DecisionPdfTemplate(3페이지 PDF 레이아웃)
│  ├─ simulation/  SimulationClockBar("다음 이벤트" 버튼, 가상 시계)
│  └─ common/      Badge, Card, KpiCard, SectionCard, StatusBadge, EmptyState, Modal, PageContainer
├─ calculations/
│  ├─ commonCalculations.ts         연료·항해시간 공통 계산
│  ├─ slowdownCalculations.ts       일정 도미노(buildScheduleDomino)만 남음
│  ├─ scenarioCalculations.ts       필요 속도/접안 대기/연료·CO2 계산 원자 함수(실제 사건 엔진의 기반)
│  ├─ scenarioDecisionCalculations.ts  4옵션(MAINTAIN/SLIGHT/REQUIRED/MIN_SPEED) 계산·권고 선정
│  ├─ incidentOptionAdapter.ts      위 4옵션 → A/B/C/D 표현 변환
│  ├─ reportRecordBuilder.ts        RTA 확정으로 사건이 COMPLETED되면 리포트 이력 자동 생성
│  ├─ fleetCalculations.ts          선대 상태 집계(computeFleetStatusSummary) — 선대 생성은 fleetData.ts
│  ├─ fleetSelectors.ts             useLiveCombinedFleet 훅 + KPI selector
│  ├─ executionSelectors.ts         승인된 판단을 실행 요약 목록으로 변환
│  └─ executionSimulation.ts        "다음 실행 단계" 진행 시뮬레이션
├─ data/
│  ├─ fleetData.ts       상세 데모 선박(VESSELS), 지도 포트/항로, 97척 COMBINED_FLEET
│  ├─ scenarios.ts       decisionStore DRAFT 기본값 몇 개만 남은 축소된 파일
│  ├─ scenarioVessels.ts GLOVIS A~E 실제 스케줄 데이터(거리·속도·ETA) + 지도 진행률 계산
│  ├─ simulationEvents.ts  가상 시뮬레이션 시계가 재생하는 이벤트 목록("다음 이벤트")
│  ├─ regionCorridors.ts 지역별 배치 항로
│  └─ map/world-land-lowres.json  세계지도 topojson
├─ services/
│  ├─ newsAnalysisClient.ts / newsSubmission.ts   시뮬레이션 뉴스 이벤트 → backend `/api/news/analyze`
│  └─ rtaAnalysisClient.ts / rtaSubmission.ts     시뮬레이션 RTA 이벤트 → backend `/api/rta/analyze`
├─ stores/ (zustand, 대부분 persist 미들웨어로 localStorage에 저장)
│  ├─ simulationStore.ts        가상 시뮬레이션 시계(currentSimTime), triggerNextEvent
│  ├─ decisionStore.ts          화면에 지금 띄운 판단 1건의 계산·승인·실행 상태(싱글턴)
│  ├─ incidentStore.ts          실제 사건(뉴스 분석 → RTA 확정)별 판단 상태
│  ├─ executionRecordsStore.ts  (incidentId, vesselId)별 실행 스냅샷(DRAFT→APPROVED→...→COMPLETED)
│  ├─ scenarioVesselStore.ts    GLOVIS 선박별 실제 실행 속도 오버라이드
│  ├─ workflowStore.ts          판단 세션 컨텍스트(선택 사건/선박, 지도 포커스)
│  ├─ alertsStore.ts            판단 대기열(앱 시작 시 빈 배열, 실제 활성화된 경보만 보관)
│  ├─ newsStore.ts              제출된 뉴스와 처리 상태
│  └─ reportStore.ts            완료된 판단 리포트 이력(CompletedDecisionRecord[])
├─ types/
│  ├─ fleet.ts           FleetVessel, FleetRegion, Vessel 등
│  ├─ signal.ts           Signal, PortEvent 등
│  ├─ decision.ts         속도 옵션·승인·실행·일정 영향(레거시 4옵션 모델)
│  ├─ scenarioDecision.ts 4옵션 모델(MAINTAIN/SLIGHT/REQUIRED/MIN_SPEED)
│  ├─ newsAnalysis.ts     Claude 뉴스 분석 응답 타입
│  ├─ rtaAnalysis.ts      Claude RTA 분석 응답 타입
│  └─ report.ts           리포트 레코드(CompletedDecisionRecord) 및 PDF용 세부 타입
├─ lib/  format.ts, seededRandom.ts, useCountdown.ts, routeMap.ts, pdfExport.ts
├─ main.tsx
└─ index.css
```

## backend/src

실시간 AIS 연동은 없다. Claude(Anthropic API)를 호출해 뉴스 기사/RTA 문서를 구조화된 분석
결과로 변환하는 것이 백엔드의 유일한 역할이다.

```
backend/src/
├─ index.ts                Express 진입점 — /api/health, /api/news/analyze, /api/rta/analyze 등록
├─ config/env.ts            zod 기반 환경변수 검증(PORT, FRONTEND_ORIGIN, ANTHROPIC_*)
├─ routes/
│  ├─ healthRoutes.ts        GET /api/health
│  ├─ newsAnalysisRoutes.ts  POST /api/news/analyze
│  └─ rtaAnalysisRoutes.ts   POST /api/rta/analyze
├─ ai/
│  ├─ news/  anthropicNewsAnalyzer.ts, newsAnalyzerPrompt.ts, newsAnalysisSchema.ts,
│  │         newsAnalysisValidator.ts, knownPorts.ts, newsAnalyzer.ts(인터페이스/에러 타입)
│  └─ rta/   anthropicRtaAnalyzer.ts, rtaAnalyzerPrompt.ts, rtaAnalysisSchema.ts,
│             rtaAnalysisValidator.ts, rtaAnalyzer.ts(인터페이스/에러 타입)
└─ types/{news.ts,rta.ts}   요청/응답 타입
```

## 참고

- 지도(D3 기반, MapLibre 등 외부 타일 서비스 없음)의 97척 배경 선대와 GLOVIS A~E 위치는 전부
  결정론적 시뮬레이션 데이터다. 뉴스/RTA는 `simulationEvents.ts`가 정한 시각에 시뮬레이션
  시계로만 접수된다 — 수동 제출 화면은 없다.
- 판단 흐름은 실제 사건(뉴스→RTA) 기반 하나뿐이다. `stores/decisionStore.ts`/
  `stores/executionRecordsStore.ts`의 `decisionMode`("SLOW_DOWN"/"SPEED_UP" 유니언)와
  `delayAssumptionHours`, `berthCutoffOverrideAt` 같은 증속 전용 필드는 이미 저장된 실행
  레코드(localStorage)와의 타입 호환을 위해 상태 모양만 남아 있고, 실제로는 항상
  `"SLOW_DOWN"`만 쓰인다.
