import type { KnownPort } from "./newsAnalysisSchema.js";

/**
 * Claude가 항만명을 제각각 반환하지 않도록 제공하는 항만 마스터.
 * PORT PACE 프런트엔드(frontend/src/data/fleetData.ts의 MAP_PORTS, data/scenarios.ts)에서
 * 이미 사용 중인 5개 항만을 기준으로 한다. UN/LOCODE는 공개된 실제 코드를 사용하고,
 * 터미널은 프로젝트 시나리오(Singapore 파업/Shanghai 임시 선석)에 등장하는 값만 반영했다.
 * 새 항만이 필요하면 이 배열에 추가한다 — Claude가 목록에 없는 항만의 코드를 임의로
 * 생성하지 않도록, canonicalName/unLocode는 항상 이 목록과 대조해 검증한다(newsAnalysisValidator.ts).
 */
export const KNOWN_PORTS: KnownPort[] = [
  {
    canonicalName: "Singapore",
    unLocode: "SGSIN",
    aliases: ["싱가포르", "싱가포르항", "Port of Singapore", "PSA Singapore", "Singapore Port"],
    terminals: ["Pasir Panjang", "Tuas"],
    timezone: "Asia/Singapore",
  },
  {
    canonicalName: "Shanghai",
    unLocode: "CNSHA",
    aliases: ["상하이", "상하이항", "Port of Shanghai", "Yangshan"],
    terminals: ["Yangshan", "Waigaoqiao"],
    timezone: "Asia/Shanghai",
  },
  {
    canonicalName: "Ulsan",
    unLocode: "KRUSN",
    aliases: ["울산", "울산항", "Port of Ulsan"],
    terminals: [],
    timezone: "Asia/Seoul",
  },
  {
    canonicalName: "Bremen",
    unLocode: "DEBRE",
    aliases: ["브레멘", "브레멘항", "Port of Bremen"],
    terminals: [],
    timezone: "Europe/Berlin",
  },
  {
    canonicalName: "Yokohama",
    unLocode: "JPYOK",
    aliases: ["요코하마", "요코하마항", "Port of Yokohama"],
    terminals: [],
    timezone: "Asia/Tokyo",
  },
  {
    canonicalName: "Southampton",
    unLocode: "GBSOU",
    aliases: ["사우샘프턴", "사우샘프턴항", "Port of Southampton", "ABP Southampton"],
    terminals: ["4번 선석", "Berth 4"],
    timezone: "Europe/London",
  },
  {
    canonicalName: "Rotterdam",
    unLocode: "NLRTM",
    aliases: ["로테르담", "로테르담항", "Port of Rotterdam"],
    terminals: [],
    timezone: "Europe/Amsterdam",
  },
  {
    canonicalName: "Busan",
    unLocode: "KRPUS",
    aliases: ["부산", "부산항", "Port of Busan"],
    terminals: [],
    timezone: "Asia/Seoul",
  },
  {
    canonicalName: "Bremerhaven",
    unLocode: "DEBRV",
    aliases: ["브레머하펜", "브레머하펜항", "Port of Bremerhaven"],
    terminals: [],
    timezone: "Europe/Berlin",
  },
  {
    canonicalName: "Zeebrugge",
    unLocode: "BEZEE",
    aliases: ["제브뤼헤", "제브뤼헤항", "Port of Zeebrugge"],
    terminals: [],
    timezone: "Europe/Brussels",
  },
  {
    canonicalName: "Hong Kong",
    unLocode: "HKHKG",
    aliases: ["홍콩", "홍콩항", "Port of Hong Kong"],
    terminals: [],
    timezone: "Asia/Hong_Kong",
  },
  {
    canonicalName: "Incheon",
    unLocode: "KRINC",
    aliases: ["인천", "인천항", "Port of Incheon"],
    terminals: [],
    timezone: "Asia/Seoul",
  },
];
