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

## 작업 지침

- [`docs/CLAUDE.md`](docs/CLAUDE.md) — 단계별 재구성 계획 및 작업 원칙
