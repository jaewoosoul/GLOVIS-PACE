import type { FleetVessel, FleetAlertStatus, FleetRegion, Vessel } from "../types/fleet";
import { pointAlongPolylineWithSegment } from "../lib/routeMap";

/**
 * 실제 세계지도 위에 표시할 항구·항로 좌표(경도, 위도).
 * 정확한 최적 항로 계산은 범위 밖이므로, 육지를 가로지르지 않도록
 * 해상 경유점을 포함한 시나리오용 좌표를 사용한다.
 */
export interface LonLat {
  lon: number;
  lat: number;
}

export interface MapPort {
  id: string;
  name: string;
  lon: number;
  lat: number;
  hasIncident: boolean;
  /** 위험 신호(hasIncident)와 구분되는 파랑/청록색 '운항 기회' 신호(예: 임시 선석 발생) */
  hasOpportunity?: boolean;
}

export const MAP_PORTS: MapPort[] = [
  { id: "ulsan", name: "Ulsan", lon: 129.3, lat: 35.5, hasIncident: false },
  { id: "shanghai", name: "Shanghai", lon: 121.5, lat: 31.2, hasIncident: false, hasOpportunity: true },
  // hasIncident/hasOpportunity는 여기 고정값 대신 FleetMap의 activeIncidentPortIds/activeOpportunityPortIds
  // (판단 대기 중인 사건 기준, 항상 실시간)로 덮어써진다 — 이 배열의 값은 두 prop을 안 넘기는 호출부가
  // 없어 사실상 쓰이지 않는다.
  { id: "singapore", name: "Singapore", lon: 103.85, lat: 1.29, hasIncident: false },
  { id: "bremen", name: "Bremen", lon: 8.8, lat: 53.1, hasIncident: false },
  { id: "yokohama", name: "Yokohama", lon: 139.65, lat: 35.45, hasIncident: false },
  { id: "rotterdam", name: "Rotterdam", lon: 4.47, lat: 51.92, hasIncident: false },
  { id: "zeebrugge", name: "Zeebrugge", lon: 3.2, lat: 51.33, hasIncident: false },
  { id: "bremerhaven", name: "Bremerhaven", lon: 8.58, lat: 53.55, hasIncident: false },
  { id: "southampton", name: "Southampton", lon: -1.4, lat: 50.9, hasIncident: false },
  { id: "hongkong", name: "Hong Kong", lon: 114.15, lat: 22.3, hasIncident: false },
  { id: "busan", name: "Busan", lon: 129.08, lat: 35.1, hasIncident: false },
  { id: "incheon", name: "Incheon", lon: 126.6, lat: 37.45, hasIncident: false },
  { id: "dakar", name: "Dakar", lon: -17.44, lat: 14.69, hasIncident: false },
  { id: "mombasa", name: "Mombasa", lon: 39.66, lat: -4.05, hasIncident: false },
  { id: "baltimore", name: "Baltimore", lon: -76.57, lat: 39.27, hasIncident: false },
  { id: "sydney", name: "Sydney", lon: 151.2, lat: -33.9, hasIncident: false },
  { id: "durban", name: "Durban", lon: 31.0, lat: -29.8, hasIncident: false },
  { id: "santos", name: "Santos", lon: -46.3, lat: -23.9, hasIncident: false },
  { id: "brisbane", name: "Brisbane", lon: 153.0, lat: -27.5, hasIncident: false },
  { id: "newyork", name: "New York", lon: -74.0, lat: 40.7, hasIncident: false },
  { id: "kobe", name: "Kobe", lon: 135.2, lat: 34.7, hasIncident: false },
  { id: "mumbai", name: "Mumbai", lon: 72.83, lat: 18.97, hasIncident: false },
  { id: "buenosaires", name: "Buenos Aires", lon: -58.4, lat: -34.6, hasIncident: false },
  { id: "hamburg", name: "Hamburg", lon: 9.99, lat: 53.55, hasIncident: false },
];

/** 항만 팝업에 영문명과 나란히 보여줄 한글명·한 줄 소개. */
export const PORT_INFO_KO: Record<string, { koreanName: string; description: string }> = {
  ulsan: { koreanName: "울산항", description: "국내 최대 완성차 수출 거점 항만" },
  shanghai: { koreanName: "상하이항", description: "세계 최대 컨테이너 물동량을 처리하는 중국 관문 항만" },
  singapore: { koreanName: "싱가포르항", description: "동남아·인도양 항로가 모이는 환적 허브 항만" },
  bremen: { koreanName: "브레멘항", description: "독일 북서부의 자동차·컨테이너 처리 항만" },
  yokohama: { koreanName: "요코하마항", description: "일본 간토 지역의 주요 무역항" },
  rotterdam: { koreanName: "로테르담항", description: "유럽 최대 규모의 물류 관문 항만" },
  zeebrugge: { koreanName: "제브뤼헤항", description: "벨기에의 완성차 처리량 세계 최상위권 항만" },
  bremerhaven: { koreanName: "브레머하펜항", description: "유럽 최대 규모의 완성차 전용 터미널 보유 항만" },
  southampton: { koreanName: "사우샘프턴항", description: "영국 남부의 완성차·크루즈 처리 항만" },
  hongkong: { koreanName: "홍콩항", description: "동아시아 해상 물류의 전통적 중계 거점" },
  busan: { koreanName: "부산항", description: "국내 최대 컨테이너 처리 항만" },
  incheon: { koreanName: "인천항", description: "수도권 물동량을 처리하는 서해안 관문 항만" },
  dakar: { koreanName: "다카르항", description: "서아프리카 세네갈의 관문 항만" },
  mombasa: { koreanName: "몸바사항", description: "동아프리카 최대 규모의 완성차 수입 항만" },
  baltimore: { koreanName: "볼티모어항", description: "미국 동부 최대 완성차 처리 항만" },
  sydney: { koreanName: "시드니항", description: "호주 최대 물동량을 처리하는 태평양 관문 항만" },
  durban: { koreanName: "더반항", description: "아프리카 최대 컨테이너 처리 항만" },
  santos: { koreanName: "산투스항", description: "남미 최대 규모의 컨테이너 처리 항만" },
  brisbane: { koreanName: "브리즈번항", description: "호주 퀸즐랜드의 관문 항만" },
  newyork: { koreanName: "뉴욕항", description: "미국 동부 최대 물류 거점 항만" },
  kobe: { koreanName: "고베항", description: "일본 간사이 지역의 주요 국제 무역항" },
  mumbai: { koreanName: "뭄바이항", description: "인도 최대 컨테이너 처리 항만" },
  buenosaires: { koreanName: "부에노스아이레스항", description: "남미 최대 규모의 물류 관문 항만" },
  hamburg: { koreanName: "함부르크항", description: "유럽 3대 항만 중 하나인 독일 최대 항만" },
};

export type MapRouteVesselId = "glovis-e" | "glovis-d" | "glovis-c" | "glovis-b" | "glovis-a";

/** 인도양 → 홍해 → 수에즈. (32.5,32.5)이 지중해 진입점 — 없으면 -0.6° 오프셋 시 시나이 반도 통과. */
const SEG_MALACCA_TO_SUEZ: LonLat[] = [
  { lon: 98, lat: 3 },
  { lon: 90, lat: 4 },
  { lon: 80, lat: 5 },
  { lon: 68, lat: 9 },
  { lon: 57, lat: 12 },
  { lon: 49, lat: 12 },
  { lon: 43.5, lat: 12.5 },
  { lon: 40, lat: 16 },
  { lon: 36, lat: 22 },
  { lon: 33.5, lat: 29 },
  { lon: 32.6, lat: 31.2 }, // 수에즈 운하 남단
  { lon: 32.5, lat: 32.5 }, // 포트사이드 북쪽 지중해 진입 — 이 점이 없으면 시나이 반도 육지 통과
];

/** 수에즈 운하 → 지중해(크레타·시칠리아 남쪽 항로) → 지브롤터 해협 */
const SEG_SUEZ_TO_GIBRALTAR: LonLat[] = [
  { lon: 27, lat: 32.5 },
  { lon: 20, lat: 34 },
  { lon: 12, lat: 35 },
  { lon: 3, lat: 36 },
  { lon: -3, lat: 36 },
  { lon: -5.6, lat: 35.95 },
];

/** 지브롤터 → 비스케이만 → 영국해협. (-8,48.5) 경유로 브르타뉴 반도 서단 우회 — 없으면 -0.6° 오프셋 시 육지 통과. */
const SEG_GIBRALTAR_TO_CHANNEL: LonLat[] = [
  { lon: -9.5, lat: 38 },
  { lon: -9, lat: 43 },
  { lon: -8, lat: 48.5 }, // 비스케이만 서쪽 — 브르타뉴 반도 서단보다 충분히 서쪽
  { lon: -3, lat: 50 },   // 영국해협 진입 — -0.6 오프셋 시 49.4°N, 브르타뉴 북단(48.8°N) 통과
];

/** 동중국해 → 바시 해협(120.5°E,19.5°N) → 남중국해. 직선 시 루손섬 육지 통과 방지용 경유점. */
const SEG_SHANGHAI_TO_SCS: LonLat[] = [
  { lon: 124, lat: 27 },
  { lon: 122.5, lat: 22 },
  { lon: 120.5, lat: 19.5 },
  { lon: 119, lat: 16 },
  { lon: 117, lat: 14 },
  { lon: 112, lat: 8 },
  { lon: 108, lat: 5 },
];

/** 부산 → 바시 해협 → 남중국해. SEG_SHANGHAI_TO_SCS와 같은 이유로 루손섬을 피해 경유점을 늘렸다. */
const SEG_BUSAN_TO_SCS: LonLat[] = [
  { lon: 126.5, lat: 30 },
  { lon: 124, lat: 25 },
  { lon: 121.5, lat: 21 },
  { lon: 119.5, lat: 17 },
  { lon: 117, lat: 14 },
  { lon: 112, lat: 8 },
  { lon: 108, lat: 5 },
];

/** 공통 대양 구간을 위도 ±1.2° 이내로 미세 이동해 5척 항로가 겹치지 않고 나란히 보이게 한다. */
function offsetLat(points: LonLat[], deltaLat: number): LonLat[] {
  return points.map((p) => ({ lon: p.lon, lat: p.lat + deltaLat }));
}

/** GLOVIS-E: Shanghai → Singapore 해협 → 수에즈 → 지브롤터 → 도버 해협 → Rotterdam */
const ROUTE_A: LonLat[] = [
  { lon: 121.5, lat: 31.2 },
  ...offsetLat(SEG_SHANGHAI_TO_SCS, 1.2),
  { lon: 103.85, lat: 1.29 },
  ...offsetLat(SEG_MALACCA_TO_SUEZ, 1.2),
  ...offsetLat(SEG_SUEZ_TO_GIBRALTAR, 1.2),
  ...offsetLat(SEG_GIBRALTAR_TO_CHANNEL, 1.2),
  { lon: 1, lat: 51 },
  { lon: 3, lat: 51.8 },
  { lon: 4.47, lat: 51.92 },
];

/** GLOVIS-D: Shanghai → Singapore → 수에즈 → 지브롤터 → Rotterdam. 첫 점이 0%이므로 Shanghai부터 시작. */
const ROUTE_B: LonLat[] = [
  { lon: 121.5, lat: 31.2 },
  ...offsetLat(SEG_SHANGHAI_TO_SCS, 0.6),
  { lon: 103.85, lat: 1.29 },
  ...offsetLat(SEG_MALACCA_TO_SUEZ, 0.6),
  ...offsetLat(SEG_SUEZ_TO_GIBRALTAR, 0.6),
  ...offsetLat(SEG_GIBRALTAR_TO_CHANNEL, 0.6),
  { lon: 1, lat: 51 },
  { lon: 3, lat: 51.8 },
  { lon: 4.47, lat: 51.92 },
];

/** GLOVIS-C: Busan → Singapore → 수에즈 → 지브롤터 → 북해 → Bremerhaven */
const ROUTE_C: LonLat[] = [
  { lon: 129.08, lat: 35.1 },
  ...SEG_BUSAN_TO_SCS,
  { lon: 103.85, lat: 1.29 },
  ...SEG_MALACCA_TO_SUEZ,
  ...SEG_SUEZ_TO_GIBRALTAR,
  ...SEG_GIBRALTAR_TO_CHANNEL,
  { lon: 1, lat: 51 },
  { lon: 3, lat: 52 },
  { lon: 5.5, lat: 53.3 },
  { lon: 8.58, lat: 53.55 },
];

/** GLOVIS-B: Shanghai → Singapore → 수에즈 → 지브롤터 → 도버 해협 → Zeebrugge */
const ROUTE_D: LonLat[] = [
  { lon: 121.5, lat: 31.2 },
  ...offsetLat(SEG_SHANGHAI_TO_SCS, -0.6),
  { lon: 103.85, lat: 1.29 },
  ...offsetLat(SEG_MALACCA_TO_SUEZ, -0.6),
  ...offsetLat(SEG_SUEZ_TO_GIBRALTAR, -0.6),
  ...offsetLat(SEG_GIBRALTAR_TO_CHANNEL, -0.6),
  { lon: 1, lat: 51 },
  { lon: 2.5, lat: 51.3 },
  { lon: 3.2, lat: 51.33 },
];

/** GLOVIS-A: Hong Kong → 남중국해 → 수에즈 → 지브롤터 → Southampton → 북해 → Bremerhaven */
const ROUTE_E: LonLat[] = [
  { lon: 114.15, lat: 22.3 },
  { lon: 112, lat: 15 },
  { lon: 105, lat: 6 },
  { lon: 100, lat: 2 },
  ...offsetLat(SEG_MALACCA_TO_SUEZ, -1.2),
  ...offsetLat(SEG_SUEZ_TO_GIBRALTAR, -1.2),
  ...offsetLat(SEG_GIBRALTAR_TO_CHANNEL, -1.2),
  { lon: -1.4, lat: 50.9 },
  { lon: 1, lat: 51 },
  { lon: 3, lat: 52 },
  { lon: 5.5, lat: 53.3 },
  { lon: 8.58, lat: 53.55 },
];

export const MAP_ROUTES: Record<MapRouteVesselId, LonLat[]> = {
  "glovis-e": ROUTE_A,
  "glovis-d": ROUTE_B,
  "glovis-c": ROUTE_C,
  "glovis-b": ROUTE_D,
  "glovis-a": ROUTE_E,
};

/** 선박별 구분 없이 GLOVIS 전 선대 동선을 동일한 파란색으로 통일해 표시한다. */
export const MAP_VESSEL_COLOR: Record<MapRouteVesselId, string> = {
  "glovis-a": "#2563eb",
  "glovis-b": "#2563eb",
  "glovis-c": "#2563eb",
  "glovis-d": "#2563eb",
  "glovis-e": "#2563eb",
};


export type OtherVesselId = "OTHER-001" | "OTHER-002" | "OTHER-003" | "OTHER-004" | "OTHER-005" | "OTHER-006" | "OTHER-007" | "OTHER-008";

/**
 * 타사 참고 선박 1: 상하이 → 시드니 (동쪽 태평양 남하)
 * 대만 동쪽 필리핀해를 경유해 호주로 향한다 — GLOVIS 서향 항로와 무관, 날짜변경선 미통과.
 */
const ROUTE_OTHER_1: LonLat[] = [
  { lon: 121.5, lat: 31.2 },   // Shanghai
  { lon: 126, lat: 25 },        // East China Sea (east of Taiwan)
  { lon: 130, lat: 18 },        // Philippine Sea
  { lon: 136, lat: 10 },        // Pacific (east of Philippines)
  { lon: 145, lat: 4 },         // Pacific (north of PNG)
  { lon: 155, lat: 0 },         // Pacific (east of PNG — PNG 동쪽 끝 ~150E 우회)
  { lon: 160, lat: -14 },       // South Pacific (솔로몬 제도 동쪽)
  { lon: 160, lat: -26 },       // South Pacific (뉴칼레도니아·바누아투 동쪽)
  { lon: 155, lat: -32 },       // Tasman Sea (그레이트배리어리프 남쪽 공해)
  { lon: 151.2, lat: -33.9 },  // Sydney
];

/**
 * 타사 참고 선박 2: 싱가포르 → 더반 (인도양 남서 횡단, 로렌소 해협 경유)
 * 롬복 해협으로 인도양 진입 후 남아프리카로 향한다 — GLOVIS 수에즈 북상 항로와 무관.
 */
const ROUTE_OTHER_2: LonLat[] = [
  { lon: 103.85, lat: 1.29 },  // Singapore
  { lon: 106, lat: -3 },        // Java Sea (north of Java)
  { lon: 110, lat: -4 },        // Java Sea east
  { lon: 118, lat: -10 },       // South of Lombok (Indian Ocean entry)
  { lon: 108, lat: -18 },       // Indian Ocean
  { lon: 88, lat: -22 },        // Central Indian Ocean
  { lon: 68, lat: -22 },        // Indian Ocean
  { lon: 50, lat: -26 },        // South Indian Ocean
  { lon: 36, lat: -29 },        // Approaching Africa
  { lon: 31.0, lat: -29.8 },   // Durban
];

/**
 * 타사 참고 선박 3: 산투스 → 로테르담 (남대서양 → 북대서양)
 * 브라질 해안 돌출부(동경 -35° 부근)를 충분히 동쪽에서 우회해 대서양 공해만 통과한다.
 * 비스케이만 진입도 기존 GLOVIS 경유점(SEG_GIBRALTAR_TO_CHANNEL)과 동일한 방식으로 처리.
 */
const ROUTE_OTHER_3: LonLat[] = [
  { lon: -46.3, lat: -23.9 },  // Santos (Brazil)
  { lon: -44, lat: -26 },       // 남동쪽으로 빠져 대서양 진입
  { lon: -40, lat: -22 },       // South Atlantic
  { lon: -37, lat: -15 },       // 브라질 해안 동쪽 공해
  { lon: -33, lat: -6 },        // 브라질 동단(~-34.8°) 동쪽 통과
  { lon: -28, lat: 2 },         // Equatorial Atlantic
  { lon: -22, lat: 12 },        // North Atlantic
  { lon: -18, lat: 22 },        // Atlantic
  { lon: -14, lat: 35 },        // Near Canaries
  { lon: -9.5, lat: 38 },       // Gibraltar approach
  { lon: -9, lat: 43 },         // Bay of Biscay south
  { lon: -8, lat: 48.5 },       // 비스케이만 서쪽 (브르타뉴 서단 회피)
  { lon: -3, lat: 50 },         // English Channel approach
  { lon: 4.47, lat: 51.92 },   // Rotterdam
];

/**
 * 타사 참고 선박 4: 고베 → 브리즈번 (남태평양 남하, 호주)
 * 규슈 동쪽으로 태평양 진입 후 남하 — GLOVIS 서향 항로와 반대 방향, 날짜변경선 미통과.
 */
const ROUTE_OTHER_4: LonLat[] = [
  { lon: 135.2, lat: 34.7 },   // Kobe
  { lon: 137, lat: 28 },        // East of Kyushu
  { lon: 141, lat: 20 },        // Pacific Ocean
  { lon: 146, lat: 10 },        // Pacific
  { lon: 150, lat: 0 },         // Equatorial Pacific
  { lon: 152, lat: -12 },       // South Pacific
  { lon: 153, lat: -22 },       // Coral Sea
  { lon: 153.0, lat: -27.5 },  // Brisbane
];

/**
 * 타사 참고 선박 5: 뉴욕 → 로테르담 (북대서양 동향 횡단)
 * 서→동 대서양 횡단 — GLOVIS 항로(아시아→유럽)와 구간 겹침 없음.
 */
const ROUTE_OTHER_5: LonLat[] = [
  { lon: -74.0, lat: 40.7 },   // New York
  { lon: -63, lat: 42 },
  { lon: -48, lat: 43 },
  { lon: -33, lat: 44 },
  { lon: -18, lat: 47 },
  { lon: -8, lat: 48 },
  { lon: -2, lat: 49 },
  { lon: 4.47, lat: 51.92 },   // Rotterdam
];

/**
 * 타사 참고 선박 6: 더반 → 뭄바이 (인도양, 마다가스카르 남쪽 우회)
 * 아프리카 동안에서 인도 서안으로 — GLOVIS 수에즈 북상 항로와 무관.
 */
const ROUTE_OTHER_6: LonLat[] = [
  { lon: 31.0, lat: -29.8 },   // Durban
  { lon: 35, lat: -35 },        // 마다가스카르 남쪽 우회 시작
  { lon: 50, lat: -32 },        // 마다가스카르 남단 이남 공해
  { lon: 62, lat: -20 },        // Central Indian Ocean
  { lon: 68, lat: -5 },         // Indian Ocean (몰디브 남쪽)
  { lon: 70, lat: 8 },          // Northern Indian Ocean
  { lon: 72.83, lat: 18.97 },  // Mumbai
];

/**
 * 타사 참고 선박 7: 부에노스아이레스 → 다카르 (남·북대서양)
 * 브라질 동단을 충분히 동쪽에서 우회해 서아프리카로 향한다.
 */
const ROUTE_OTHER_7: LonLat[] = [
  { lon: -58.4, lat: -34.6 },  // Buenos Aires
  { lon: -53, lat: -38 },       // 리오 데 라 플라타 하구 동남쪽 출구 → 대서양 진입
  { lon: -44, lat: -28 },       // South Atlantic (브라질 해안 서쪽)
  { lon: -38, lat: -18 },       // Atlantic (브라질 동안 ~-39°E 동쪽)
  { lon: -34, lat: -6 },        // 브라질 동단(-34.8°E) 동쪽 통과
  { lon: -26, lat: 2 },         // Equatorial Atlantic
  { lon: -20, lat: 8 },         // North Atlantic
  { lon: -17.44, lat: 14.69 }, // Dakar
];

/**
 * 타사 참고 선박 8: 함부르크 → 뉴욕 (북대서양 서향 횡단)
 * 동→서 방향이라 GLOVIS 아시아→유럽 항로와 완전히 분리.
 */
const ROUTE_OTHER_8: LonLat[] = [
  { lon: 9.99, lat: 53.55 },   // Hamburg
  { lon: 3, lat: 52 },
  { lon: -3, lat: 50 },          // English Channel exit
  { lon: -8, lat: 48.5 },       // 비스케이만 서쪽 (브르타뉴 서단 회피)
  { lon: -9, lat: 43 },
  { lon: -20, lat: 42 },        // North Atlantic
  { lon: -40, lat: 42 },
  { lon: -60, lat: 42 },
  { lon: -74.0, lat: 40.7 },   // New York
];

export const OTHER_FLEET_ROUTES: Record<OtherVesselId, LonLat[]> = {
  "OTHER-001": ROUTE_OTHER_1,
  "OTHER-002": ROUTE_OTHER_2,
  "OTHER-003": ROUTE_OTHER_3,
  "OTHER-004": ROUTE_OTHER_4,
  "OTHER-005": ROUTE_OTHER_5,
  "OTHER-006": ROUTE_OTHER_6,
  "OTHER-007": ROUTE_OTHER_7,
  "OTHER-008": ROUTE_OTHER_8,
};

interface OtherVesselDef {
  id: OtherVesselId;
  speedKnots: number;
  region: FleetRegion;
  departureAtIso: string;
  arrivalAtIso: string;
}

const OTHER_VESSEL_DEFS: OtherVesselDef[] = [
  // 시뮬 시작(Sep 1 20:00) 기준 항구에서 막 출발한 위치(~8%)에 두도록 출발일 역산
  { id: "OTHER-001", speedKnots: 14.0, region: "EAST_ASIA",             departureAtIso: "2026-08-30T00:00:00+09:00", arrivalAtIso: "2026-09-22T00:00:00+09:00" },
  { id: "OTHER-002", speedKnots: 12.0, region: "SOUTHEAST_ASIA_INDIAN", departureAtIso: "2026-08-29T00:00:00+09:00", arrivalAtIso: "2026-10-06T00:00:00+09:00" },
  { id: "OTHER-003", speedKnots: 13.0, region: "EUROPE_MEDITERRANEAN",  departureAtIso: "2026-08-30T00:00:00+09:00", arrivalAtIso: "2026-09-29T00:00:00+09:00" },
  { id: "OTHER-004", speedKnots: 14.0, region: "EAST_ASIA",             departureAtIso: "2026-10-08T00:00:00+09:00", arrivalAtIso: "2026-10-24T00:00:00+09:00" },
  { id: "OTHER-005", speedKnots: 14.0, region: "EUROPE_MEDITERRANEAN",  departureAtIso: "2026-11-01T00:00:00+09:00", arrivalAtIso: "2026-11-16T00:00:00+09:00" },
  { id: "OTHER-006", speedKnots: 13.0, region: "SOUTHEAST_ASIA_INDIAN", departureAtIso: "2026-09-18T00:00:00+09:00", arrivalAtIso: "2026-10-08T00:00:00+09:00" },
  { id: "OTHER-007", speedKnots: 13.0, region: "EUROPE_MEDITERRANEAN",  departureAtIso: "2026-10-22T00:00:00+09:00", arrivalAtIso: "2026-11-07T00:00:00+09:00" },
  { id: "OTHER-008", speedKnots: 14.0, region: "EUROPE_MEDITERRANEAN",  departureAtIso: "2026-11-14T00:00:00+09:00", arrivalAtIso: "2026-11-28T00:00:00+09:00" },
];

/** 타사 선박 스케줄(출발·도착 ms) — FleetMap·fleetSelectors에서 진행률 계산에 사용한다. */
export const OTHER_VESSEL_SCHEDULE: Record<OtherVesselId, { departureMs: number; arrivalMs: number }> = Object.fromEntries(
  OTHER_VESSEL_DEFS.map((d) => [
    d.id,
    { departureMs: new Date(d.departureAtIso).getTime(), arrivalMs: new Date(d.arrivalAtIso).getTime() },
  ]),
) as Record<OtherVesselId, { departureMs: number; arrivalMs: number }>;

/** Singapore 항만 혼잡을 보여주기 위한 고정 대기 선박 점 (fixture, 상세 데이터 없음) */
export const WAITING_SHIPS_NEAR_SINGAPORE: LonLat[] = [
  { lon: 104.05, lat: 1.42 },
  { lon: 104.12, lat: 1.18 },
  { lon: 103.65, lat: 1.42 },
  { lon: 103.6, lat: 1.1 },
  { lon: 104.2, lat: 1.32 },
  { lon: 103.9, lat: 0.98 },
  { lon: 104.0, lat: 1.55 },
  { lon: 103.5, lat: 1.25 },
  { lon: 104.28, lat: 1.05 },
  { lon: 103.78, lat: 1.6 },
];

/**
 * GLOVIS-A~E는 실제 특정 선박의 운항기록을 재현한 것이 아니라, PORT PACE v7 시나리오
 * (docs/PORT_PACE_v7_통합_구현명세_Claude_Code.md, scenarioVessels.ts)의 5척 데모 선대다.
 * destinationPort는 각 선박의 최종 도착항을 가리킨다 — 사건이 실제로 발생하는 구간 목적항
 * (예: A의 Southampton)은 scenarioVessels.ts의 destinationPortCode를 따로 쓴다. 실시간 속도·ETA·
 * 운항 상태는 여기 정적값이 아니라 scenarioVessels.ts/scenarioVesselStore 기준으로 계산된다
 * (calculations/fleetSelectors.ts, components/fleet/FleetMap.tsx의 resolveLive* 함수들).
 */
export const VESSELS: Vessel[] = [
  {
    id: "glovis-e",
    name: "GLOVIS-E",
    vesselType: "8,000 CEU PCTC",
    route: ["Shanghai", "Rotterdam"],
    currentSpeedKnots: 17.5,
    destinationPort: "Rotterdam",
    scheduleBufferHours: 24,
    routeProgressPercent: 0,
  },
  {
    id: "glovis-d",
    name: "GLOVIS-D",
    vesselType: "6,000 CEU PCTC",
    route: ["Shanghai", "Rotterdam"],
    currentSpeedKnots: 17.0,
    destinationPort: "Rotterdam",
    scheduleBufferHours: 18,
    routeProgressPercent: 0,
  },
  {
    id: "glovis-c",
    name: "GLOVIS-C",
    vesselType: "7,500 CEU PCTC",
    route: ["Busan", "Singapore", "Bremerhaven"],
    currentSpeedKnots: 17.0,
    destinationPort: "Bremerhaven",
    scheduleBufferHours: 30,
    routeProgressPercent: 0,
  },
  {
    id: "glovis-b",
    name: "GLOVIS-B",
    vesselType: "4,300 CEU PCTC",
    route: ["Shanghai", "Singapore", "Zeebrugge"],
    currentSpeedKnots: 15.5,
    destinationPort: "Zeebrugge",
    scheduleBufferHours: 24,
    routeProgressPercent: 0,
  },
  {
    id: "glovis-a",
    name: "GLOVIS-A",
    vesselType: "6,500 CEU PCTC",
    route: ["Hong Kong", "Southampton", "Bremerhaven"],
    currentSpeedKnots: 16.0,
    destinationPort: "Bremerhaven",
    scheduleBufferHours: 0,
    routeProgressPercent: 0,
  },
];

/** 시뮬레이션 시작(9/2 00:00) 시점엔 아직 어떤 사건도 발생하지 않아 판단 대기열이 비어 있다 — 5척 모두 NORMAL로 시작하고, 실제 뉴스/RTA 이벤트가 발생해야 DECISION/EXECUTING으로 바뀐다(calculations/fleetSelectors.ts의 실시간 오버레이). */
const DETAIL_ALERT_STATUS: Record<string, FleetAlertStatus> = {
  "glovis-e": "NORMAL",
  "glovis-d": "NORMAL",
  "glovis-c": "NORMAL",
  "glovis-b": "NORMAL",
  "glovis-a": "NORMAL",
};

export const COMBINED_FLEET: FleetVessel[] = VESSELS.map((vessel) => {
  const routeId = vessel.id as MapRouteVesselId;
  const route = MAP_ROUTES[routeId];
  const pos = pointAlongPolylineWithSegment(route.map((p) => ({ x: p.lon, y: p.lat })), vessel.routeProgressPercent);
  return {
    id: vessel.id,
    displayName: vessel.name,
    longitude: pos.x,
    latitude: pos.y,
    heading: pos.angleDeg,
    speedKnots: vessel.currentSpeedKnots,
    routeId: `${routeId}-detail`,
    region: "EAST_ASIA",
    operationStatus: "SAILING",
    alertStatus: DETAIL_ALERT_STATUS[vessel.id] ?? "NORMAL",
    dataType: "DEMO_DETAIL",
    ownership: "OWN",
  };
});

export const OTHER_FLEET: FleetVessel[] = OTHER_VESSEL_DEFS.map((def) => {
  const route = OTHER_FLEET_ROUTES[def.id];
  const pos = pointAlongPolylineWithSegment(route.map((p) => ({ x: p.lon, y: p.lat })), 0);
  return {
    id: def.id,
    displayName: def.id,
    longitude: pos.x,
    latitude: pos.y,
    heading: pos.angleDeg,
    speedKnots: def.speedKnots,
    routeId: def.id,
    region: def.region,
    operationStatus: "SAILING",
    alertStatus: "NORMAL",
    dataType: "SIMULATED_FLEET",
    ownership: "OTHER",
  };
});

/**
 * 현재 판단 중(DRAFT)이거나 실행 중(APPROVED~MONITORING)인 선박들의 alertStatus를 덮어써 반환한다.
 * COMBINED_FLEET 자체(위치·나머지 선박)는 그대로 두고, overlay에 명시된 vesselId만 갱신한다.
 */
export function applyLiveVesselStatus(fleet: FleetVessel[], overlay: Map<string, FleetAlertStatus>): FleetVessel[] {
  if (overlay.size === 0) return fleet;
  return fleet.map((v) => (overlay.has(v.id) ? { ...v, alertStatus: overlay.get(v.id)! } : v));
}

