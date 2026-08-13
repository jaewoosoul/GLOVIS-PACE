# PORT PACE v7 — 통합 구현 명세

> v7 시계열 시나리오(뉴스→RTA 기반 운항 판단)의 계산 공식·시나리오 데이터·NEWS/RTA 처리 원칙을
> 실제 코드 기준으로 담은 문서다. 문제 정의·핵심 사용자 같은 제품 배경은
> `docs/PORT_PACE_프로젝트_이해_현재구현기준.md`, 폴더/파일 구조는 `docs/project-structure.md`를 본다.

---

## 1. 핵심 원칙

```text
AI는 읽고 설명하고 쓴다.
코드는 선박·시간·연료·비용을 계산한다.
최종 운항 결정은 사람이 승인한다.
```

**AI(Claude, backend 경유) 담당**
- 일반 뉴스에서 항만, 사건 유형, 발생 시각, 추정 지연, 근거 문장 추출
- RTA 통보에서 문서번호, 발행시각, ETA 구간, 구간별 조정시간 추출
- 계산 결과를 자연어로 설명(AI 근거 탭)

**코드(프런트 `calculations/`) 담당**
- 현재 선단과 뉴스 관련성 판정(트리아지, §5)
- 선박의 잔여 기항지·ETA 대조, 잔여거리·필요 속도·도착/대기/접안 시각·연료·CO₂ 계산
- 감속 하한 적용

**사람 담당**
- 뉴스 추정 지연값 확인
- 운항 속도안 선택·승인
- RTA 변경 발생 시 재승인

이 구현에서 계산에 AI를 쓰지 않는다는 원칙은 그대로 지켜졌다 — `calculations/scenarioDecisionCalculations.ts`의
`calculateVesselDecision()`이 유일한 계산 경로이고 결정론적 순수 함수다.

---

## 2. 가상 시뮬레이션 시계

실제 구현은 배속 재생·자동 진행이 아니라, 담당자가 **"다음 이벤트" 버튼을 누를 때마다 다음
미실행 이벤트로 한 번에 건너뛰는 방식**이다(`frontend/src/stores/simulationStore.ts`).

```text
시작 시각: 2026-09-01 20:00 KST, GLOVIS-A 출항 시점(1막 사우샘프턴부터 시작 — 특정 막으로 건너뛰는 모드는 없다)
전진 방식: "다음 이벤트" 클릭 시 다음 미실행 이벤트 시각으로 즉시 이동
재생/일시정지/배속(×1, ×60...) 컨트롤은 없다
```

- 뉴스/RTA 이벤트가 실행되면 그 자리에서 Claude 분석까지 기다린 뒤 완료된다(`triggerNextEvent`).
- 노이즈(NOISE)와 선박 상태(VESSEL) 이벤트는 로그만 남기고 조용히 지나간다.
- 실행한 이벤트 id는 `executedEventIds`에 남아(localStorage persist) 새로고침해도 중복 실행되지 않는다.
- "초기화" 버튼이 시계·뉴스·경보·사건·리포트·판단/실행 세션을 전부 처음 상태로 되돌린다.

---

## 3. 핵심 선박 5척

`frontend/src/data/scenarioVessels.ts`에 그대로 구현되어 있다.

| ID | 선박명 | 선복량 | 선령 | 기준속도 | 감속 하한 | 하역시간 | 항로 |
|---|---|---:|---:|---:|---:|---:|---|
| A | GLOVIS-A | 6,500 CEU | 12년 | 16.0 kn | 12.5 kn | 18 h | 홍콩 → 사우샘프턴 → 브레머하펜 |
| B | GLOVIS-B | 4,300 CEU | 10년 | 15.5 kn | 12.0 kn | 13 h | 상하이 → 싱가포르 → 제브뤼헤 |
| C | GLOVIS-C | 7,500 CEU | 8년 | 17.0 kn | 13.0 kn | 20 h | 부산 → 싱가포르 → 브레머하펜 |
| D | GLOVIS-D | 6,000 CEU | 5년 | 17.0 kn | 13.0 kn | 17 h | 인천 → 상하이 → 로테르담 |
| E | GLOVIS-E | 8,000 CEU | 3년 | 17.5 kn | 13.0 kn | 22 h | 상하이 → 로테르담 |

`originalAssignedEtaIso`(RTA 구간 매칭용 고정 기준값)와 `departureAtIso`(구간 출항 시각)는
선박마다 시나리오 시작 시점 기준으로 미리 고정돼 있다 — 감속 후 재계산된 도착시각으로 절대
다시 매칭하지 않는다(§9.3 참고). GLOVIS-A는 시뮬레이션 시작 시각(9/1 20:00)에 막 출항한 상태로
시작해 1막(사우샘프턴) 사건의 대상이 된다.

항만 마스터는 Singapore, Shanghai, Busan, Rotterdam, Southampton, Bremerhaven, Zeebrugge,
Hong Kong, Incheon을 포함한다.

---

## 4. 전체 타임라인 (`frontend/src/data/simulationEvents.ts`)

같은 사건의 NEWS와 RTA는 같은 `incidentId`를 공유하며, RTA는 새 사건을 만들지 않고 기존
사건을 갱신한다.

### 1막 — 사우샘프턴 (`incident-sou-crane-2026-09`)

| ID | 시각 | 유형 | 내용 |
|---|---|---|---|
| E-01 | 09/02 09:00 | NEWS | 사우샘프턴 크레인 고장, 약 24시간 지연 전망 — A선 1차 판단 |
| N-01~N-04 | 09/03~09/21 | NOISE | 항만명/시점/사유유형 불일치로 걸러지는 노이즈 4건(로그만) |
| R-01 | 09/25 02:00 | RTA | 09/26~09/28 입항 +24h, 09/29~09/30 +14h, 10/01~ 조정 없음 |
| V-07 / V-07b | 09/28 02:00 | VESSEL | A 사우샘프턴 접안(BERTHED) → 출항(SAILING) |
| V-08 / V-08b | 09/30 08:00 | VESSEL | A 브레머하펜 접안(BERTHED) → 하역 완료(COMPLETED) — 1막 종료 |

### 2막 — 싱가포르 (`incident-sgp-typhoon-2026-10`)

| ID | 시각 | 유형 | 내용 |
|---|---|---|---|
| E-02 | 10/02 14:00 | NEWS | 싱가포르 태풍, 16시간 전망 — B·C 1차 판단 |
| E-02-NOISE | 10/03 09:00 | NOISE | 크루즈 터미널 방문객 증가(무관 기사, 로그만) |
| R-02 | 10/05 07:00 | RTA | 10/06~10/09 입항 +16h, 10/10~10/11 +5h, 10/12~ 조정 없음 |
| V-09 / V-09b | 10/07 23:00 | VESSEL | B 싱가포르 접안(BERTHED) → 출항(SAILING) |
| V-10 / V-10b | 10/09 03:00 | VESSEL | C 싱가포르 접안(BERTHED) → 출항(SAILING) |
| N-05, N-09, N-06 | 10/08~10/15 | NOISE | 항만명/사유유형 불일치 노이즈 3건(로그만) |
| V-11 / V-11b | 10/30 16:00 | VESSEL | B 제브뤼헤 접안(BERTHED) → 하역 완료(COMPLETED) |
| V-12 / V-12b | 10/30 17:00 | VESSEL | C 브레머하펜 접안(BERTHED) → 하역 완료(COMPLETED) |

### 3막 — 로테르담 (`incident-rtm-strike-2026-11`)

| ID | 시각 | 유형 | 내용 |
|---|---|---|---|
| V-13 | 10/31 12:00 | VESSEL | D 상하이 출항 |
| V-14 | 11/03 09:00 | VESSEL | E 상하이 출항 |
| E-03 | 11/04 10:00 | NEWS | 로테르담 파업, 26시간 전망 — D·E 1차 판단 |
| N-07, N-08, N-10 | 11/04~11/20 | NOISE | 항만명 불일치 노이즈 3건(로그만) |
| R-03 | 11/24 06:00 | RTA | D +31h, E +28h 확정 — 선박별 추가 감속 |
| V-15/V-16 | 11/27~11/28 | VESSEL | D 접안 → 하역 완료(선석 반환) |
| V-17/V-18 | 11/29~11/30 | VESSEL | E 접안 → 하역 완료 — 데모 종료 |

---

## 5. NEWS와 RTA의 구분

### NEWS — 언론 1차 정보(추정)
```text
지연값: 추정값(provisionalDelayHours)
표시: AI 추정 / 잠정
```
처리 흐름: 뉴스 수신 → Claude 구조화(`/api/news/analyze`) → 코드가 관련 선박 트리아지 →
`provisionalDelayHours` 저장 → 선박별 필요 속도 계산 → 잠정 판단 카드 생성 → 사용자 승인.

### RTA — 항만 공식 확정
```text
지연값: 기존 배정 ETA 구간별 확정값(confirmedDelayHours)
표시: 항만 공식 RTA / 확정
```
처리 흐름: RTA 수신 → Claude 구간 테이블 파싱(`/api/rta/analyze`) → 기존 incident 검색 →
각 선박의 `originalAssignedEtaIso`를 RTA 구간에 매칭(`matchBand`, `incidentStore.ts`) →
`confirmedDelayHours` 저장 → provisional과 confirmed 비교 → 유지 또는 추가 감속.

중요 규칙(그대로 구현됨):
- RTA는 새 사건을 만들지 않고 기존 사건을 갱신한다.
- `provisionalDelayHours`와 `confirmedDelayHours`를 절대 같은 필드에 덮어쓰지 않는다.
- RTA 구간은 **조정 전 `originalAssignedEtaIso`**로만 매칭한다 — 감속 후 도착 시각으로 재매칭하지 않는다.

### 비교 상태 (`incidentStore.ts`의 `VesselComparisonStatus`)
```ts
type VesselComparisonStatus =
  | "VERIFIED_UNCHANGED"               // 확정값 = 추정값 → 현재 속도 유지
  | "REVIEW_REQUIRED_INCREASED_DELAY"  // 확정값 > 추정값 → 증분만큼 추가 감속 재계산
  | "REVIEW_REQUIRED_REDUCED_DELAY"    // 확정값 < 추정값(기본 시나리오엔 없음, 함수는 지원)
  | "UNMATCHED";                       // RTA 구간에 매칭되는 선박 없음
```

---

## 6. 트리아지 로직

AI가 관련 선박을 결정하지 않는다 — 항만명·시점·사유 유형을 코드가 대조한다.

```text
IF  뉴스 항만이 선박의 목적항(destinationPortCode)과 같고
AND 선박의 원계획 ETA가 뉴스 영향 기간과 겹치고
AND 사건 유형이 운항에 영향을 주는 사유(파업/태풍/장비고장/혼잡 등)에 포함되면

알림 + 대상 선박 + 운항 판단 생성

ELSE
로그에 판정 사유(filteredBy: PORT_MISMATCH/TIME_WINDOW_MISMATCH/CAUSE_NOT_OPERATIONAL)만 저장
```

노이즈 이벤트도 Claude 파싱은 거치지만(뉴스 목록에 표시) 판단 카드는 만들지 않는다.

---

## 7. 계산 단위와 상수

- 거리 nm · 속도 kn · 시간 h · 연료 ton · 비용 USD · 날짜 ISO 8601
- 내부 계산은 반올림하지 않고, 화면에서만 반올림한다

```ts
// calculations/scenarioCalculations.ts
export const V7_FUEL_PRICE_USD_PER_TON = 640;
export const V7_ANCHORAGE_FUEL_TON_PER_DAY = 5.0;
export const V7_CO2_TON_PER_FUEL_TON = 3.114;
```

---

## 8. 핵심 계산 공식 (`calculations/scenarioCalculations.ts`)

```text
FuelRate(V)        = 0.1727 × V² − 0.217 × V                         (일일 연료율, t/day)
SailingHours        = D / V
T_max(흡수 한계)     = D × (1/V_min − 1/V_base)
V_req(필요 속도)     = D / (D / V_current + T_증분)
D_min(마지노선 잔여거리) = T_delay / (1/V_min − 1/V_base)
CandidateArrival    = 계산 기준시각 + D / V_후보
BerthAvailableAt     = originalAssignedEtaIso + 총 확정 지연
WaitHours            = max(0, BerthAvailableAt − CandidateArrival)
DownstreamDelayHours = max(0, CandidateArrival − BerthAvailableAt)   (선택으로 만든 추가 지연)
SailingFuelTon       = FuelRate(V) × SailingHours / 24
AnchorageFuelTon     = 5.0 × WaitHours / 24
FuelSavedTon         = 기준안 총연료 − 후보 총연료
FuelSavedUSD         = FuelSavedTon × 640
CO2AvoidedTon         = max(0, FuelSavedTon) × 3.114
```

`V_req`의 `T_증분`은 "지금부터 추가로 흡수해야 하는" 증분 지연이고, `BerthAvailableAt`의
"총 확정 지연"은 원 스케줄 대비 총 지연이다 — 이 둘을 같은 값으로 계산하면(RTA 재확정
시점에 이미 일부를 흡수한 상태라면) 선석 가용 시각이 잘못 계산된다. `calculateVesselDecision()`은
`additionalDelayHours`(전자)와 `totalDelayHours`(후자)를 분리된 인자로 받는다.

CII/순번 페널티/평균 접안 간격 같은 원본 자료에 확정값이 없는 항목은 계산하지 않는다 —
불확실한 단가를 하드코딩하지 않는다는 원칙을 그대로 지켰다.

---

## 9. 4옵션 판단 모델

`calculateVesselDecision()`이 선박별로 최대 4개 옵션을 계산한다(`types/scenarioDecision.ts`).

| 옵션 | 속도 | 의미 |
|---|---|---|
| 현재 속도 유지 (MAINTAIN) | 현재 승인 속도 | 기준 비교안. 대기시간이 가장 크다 |
| 소폭 감속 (SLIGHT) | 유지↔필요 속도 사이 40% 지점 | 지연을 다 흡수하진 못하지만 유지보다 나은 절충안 |
| 표준 감속 (REQUIRED) | 계산된 `V_req` | 사건 지연을 항해시간으로 정확히 흡수 — 기본 권고 후보 |
| 최대 감속 (MIN_SPEED) | 선박별 `V_min` | 연료 절감은 가장 크지만 하한으로도 못 흡수하면 하방 지연 발생 |

속도가 같은 옵션은 dedupe해서 하나만 남긴다. 권고 옵션은 하방 지연이 없는(또는 무시할 수
있는, §10 참고) 후보 중 필요 속도와 일치하는 옵션을 우선한다.

필요 속도가 감속 하한보다 낮게 계산되면 하한으로 clamp하고, 못 흡수한 나머지는 정박 대기로
남는다.

---

## 10. 잔여-오차 허용치

시나리오 고정 데이터(잔여거리/원 ETA)가 분 단위까지 완전히 맞아떨어지지 않아, 지연을 정확히
흡수하는 옵션도 하방 지연이 정확히 0이 아니라 수십 분으로 계산될 수 있다. 이 이내는 "사실상
0"으로 본다.

```ts
// calculations/scenarioDecisionCalculations.ts
export const NEGLIGIBLE_DOWNSTREAM_DELAY_HOURS = 0.5;
```

권고 선정·위험도 배지·리포트 절감액 스냅 등 화면 전체가 이 상수 하나를 공유한다 — 화면마다
다른 기준으로 "위험"을 판정하면 안 되기 때문이다.

---

## 11. 사건/판단 상태 모델

사건 전체 상태(`incidentStore.ts`)와 선박별 실행 진행 상태(`executionRecordsStore.ts`)
두 계층으로 구현되어 있다.

```ts
// 사건 전체 상태 (incidentStore.ts)
type IncidentStatus =
  | "NEWS_ONLY"                          // 뉴스만 접수, 아직 속도 미확정
  | "DECIDED"                            // 뉴스 기준으로 속도 확정, RTA 대기
  | "VERIFIED_UNCHANGED"                 // RTA=추정치, 재검토 불필요
  | "REVIEW_REQUIRED_INCREASED_DELAY"    // RTA>추정치, 재검토 필요
  | "REVIEW_REQUIRED_REDUCED_DELAY"      // RTA<추정치, 재검토 필요
  | "COMPLETED";                         // 사건에 걸린 선박 전부 최종 확정

// 선박별 실행 진행 상태 (executionRecordsStore.ts)
type DecisionStatus = "DRAFT" | "APPROVED" | "EXECUTING" | "MONITORING" | "COMPLETED";
```

"다음 실행 단계" 클릭 4번으로 APPROVED→EXECUTING→MONITORING→COMPLETED까지 진행한다.
RTA 재확정(`confirmRevision`)은 이 클릭 진행과 무관하게 즉시 COMPLETED로 넘긴다 — RTA는
확정했는데 대시보드는 여전히 실행 중이라는 모순을 막기 위해서다.

---

## 12. 리포트

판단이 COMPLETED되면(RTA 확정 후에만, §11) `reportRecordBuilder.ts`가 자동으로
`CompletedDecisionRecord`를 만들어 `/reports`에 쌓는다. 3페이지 PDF(사건·AI 판단·선택 방법 /
계산식·경제효과 상세 / "뉴스 전 속도 vs RTA 확정 후 속도" 전후 비교)로 내보낼 수 있다.
자세한 구조는 `docs/dashboard-plan.md` §8 참고.

---

## 13. 아직 계산만 있고 화면에 안 붙은 것

`calculations/scenarioCalculations.ts`의 `checkBerthConflict()`(같은 항만 선박의 선석 점유
충돌 검사)는 구현·단위테스트까지 돼 있지만 어떤 화면에서도 호출하지 않는다. 로테르담 3막처럼
같은 항만에 D·E가 시차를 두고 접안하는 시나리오에서 실제로 충돌이 없는지 확인하려면 이 함수를
직접 호출해 검증해야 한다(§14.6 참고) — UI에 노출하려면 별도 작업이 필요하다.

---

## 14. 시나리오 기대값 (테스트 오라클)

`calculations/scenarioCalculations.test.ts`가 검증하는 값과 동일하다. 시나리오 데이터나
계산식을 고칠 때 이 값들이 여전히 성립하는지 확인한다.

### A선 — 사우샘프턴 (1막)
```text
E-01 시점 잔여거리: 9,492 nm · 뉴스 추정 24h · 기준속도 16.0kn · 필요 속도 15.38kn
R-01 확정: 24h(추정과 동일) → 속도 변화 없음
```

### B선 — 싱가포르 (2막)
```text
E-02 시점(출항 후 30h): 잔여거리 1,745 nm · 뉴스 추정 16h · 기준 15.5kn · 하한 12.0kn
흡수 한계 32.8h · 필요 속도 13.57kn (여력 사용 약 49%)
R-02 확정 16h(추정과 동일) → 13.57kn 유지, 접안 10/07 23:00
```

### C선 — 싱가포르 (2막)
```text
E-02 시점(출항 후 6h): 잔여거리 2,397 nm · 뉴스 추정 16h · 기준 17.0kn · 하한 13.0kn
흡수 한계 43.4h · 필요 속도 15.27kn (여력 사용 약 37%)
R-02 확정 16h(추정과 동일) → 15.27kn 유지, 접안 10/09 03:00
```

### D선 — 로테르담 (3막)
```text
E-03 시점: 잔여거리 8,902 nm · 뉴스 추정 26h · 기준 17.0kn · 1단계 속도 16.20kn
R-03 확정 31h(+5h 증분) → 2단계 속도 15.17kn, 접안 11/27 13:00
```

### E선 — 로테르담 (3막)
```text
E-03 시점: 잔여거리 약 10,062 nm · 뉴스 추정 26h · 기준 17.5kn · 1단계 속도 16.74kn
R-03 확정 28h(+2h 증분) → 2단계 속도 16.48kn, 접안 11/29 13:00
```

### 로테르담 선석 점유
```text
D 접안 11/27 13:00 → 하역완료·선석반환 11/28 06:00
E 접안 11/29 13:00 → 하역완료 11/30 11:00
반환~접안 사이 31시간, 선석 충돌 없음 (§13: 실제 UI에서 자동 검사되지 않음)
```
