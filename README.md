# PORT PACE

목적항 파업·태풍·장비고장·항만혼잡 발생 시 자사선 감속/증속 옵션별 연료비·대기시간·CO2·후속일정
영향을 계산해 운항 담당자의 승인·실행·리포트 작성을 지원하는 운항 의사결정 지원 대시보드다.

> MOVE-AI 2026 제출용 저장소. 단계별로 재구성 중이며, 각 단계 진행 상황은 `docs/CLAUDE.md`를 따른다.

## 프로젝트 구조

```
GLOVIS-PACE/
├─ frontend/   React + Vite + TypeScript — PORT PACE 대시보드/지도/판단/리포트
├─ backend/    Node.js + TypeScript + Express — Claude(Anthropic) 기반 뉴스/RTA 분석 API
├─ docs/       설계·구조 문서
├─ package.json  루트 실행 스크립트(npm --prefix 기반, workspaces 아님)
└─ .gitignore
```

## 설치

```bash
npm install
npm --prefix frontend install
npm --prefix backend install
```

## 실행 방법

```bash
npm run dev
```

프런트(`http://localhost:5173`)와 백엔드(`http://localhost:4000`)가 동시에 실행된다(`concurrently`).
개별 실행도 가능하다.

```bash
npm run dev:frontend
npm run dev:backend
```

## 환경변수

- `frontend/.env.example` 참고 — `VITE_API_BASE_URL`
- `backend/.env.example` 참고 — `PORT`, `FRONTEND_ORIGIN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_TIMEOUT_MS`

## 배포 (Vercel + Render)

프런트는 Vercel, 백엔드는 Render에 배포한다. 저장소 루트를 그대로 연결하고 각 플랫폼에서 프로젝트의
Root Directory만 지정하면 된다.

### 1. Backend — Render

- `render.yaml`(저장소 루트) 참고 — Root Directory `backend`, Build `npm install && npm run build`,
  Start `npm start`
- Render 대시보드에서 직접 입력해야 하는 값(`sync: false`라 blueprint에 값이 없음):
  - `FRONTEND_ORIGIN` — 아래 2번에서 나오는 Vercel 배포 URL(`https://xxx.vercel.app`)
  - `ANTHROPIC_API_KEY` — 실제 API 키
- `PORT`는 Render가 자동으로 주입하므로 직접 설정하지 않는다.

### 2. Frontend — Vercel

- `frontend/vercel.json` 참고 — SPA 라우팅(새로고침 시 404 방지)을 위한 rewrite만 포함
- Vercel 프로젝트 설정에서 Root Directory를 `frontend`로 지정
- 환경변수: `VITE_API_BASE_URL` — 1번에서 나온 Render 백엔드 URL(`https://xxx.onrender.com`)

### 3. CORS 연결 (배포 후 상호 반영)

두 서비스 모두 처음 배포할 때는 상대방 URL을 모르므로, 순서대로 진행한다.

1. Render에 백엔드를 먼저 배포한다(`FRONTEND_ORIGIN`은 임시로 비워두거나 로컬 주소로 둬도 됨) → 백엔드 URL 확보
2. Vercel에 프런트를 배포하며 `VITE_API_BASE_URL`에 1번의 백엔드 URL을 입력 → 프런트 URL 확보
3. Render로 돌아가 `FRONTEND_ORIGIN`을 2번의 프런트 URL로 갱신하고 재배포

### 4. 최종 검증

- 배포된 프런트 URL로 접속해 `/dashboard`가 정상 렌더링되는지 확인
- `curl https://<backend>/api/health`로 백엔드 응답 확인
- `/news`에서 "다음 이벤트"를 눌러 뉴스 이벤트까지 진행시켜 실제 Claude 분석이 CORS 에러 없이 동작하는지 확인

## 작업 지침

- [`docs/CLAUDE.md`](docs/CLAUDE.md) — 단계별 재구성 계획 및 작업 원칙

## 설계 문서

- [`docs/PORT_PACE_프로젝트_이해_현재구현기준.md`](docs/PORT_PACE_프로젝트_이해_현재구현기준.md) — 문제 정의, 핵심 사용자, 판단 카드 설계 의도
- [`docs/dashboard-plan.md`](docs/dashboard-plan.md) — 화면·컴포넌트·상태·계산 모듈 구조
- [`docs/project-structure.md`](docs/project-structure.md) — frontend/backend 폴더 구조
- [`docs/PORT_PACE_v7_통합_구현명세_Claude_Code.md`](docs/PORT_PACE_v7_통합_구현명세_Claude_Code.md) — 뉴스/RTA 시나리오·계산 공식·타임라인 상세 스펙
- [`docs/Claude_Code_뉴스_RTA_원문_입력.md`](docs/Claude_Code_뉴스_RTA_원문_입력.md) — 데모 시나리오 뉴스/RTA 원문 fixture
