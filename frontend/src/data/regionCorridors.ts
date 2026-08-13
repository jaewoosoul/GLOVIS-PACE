import type { FleetRegion } from "../types/fleet";
import type { LonLat } from "./fleetData";

/** 지도 시연용 대표 항로 corridor (희미하게 배경 표시, 실제 특정 선박 항로 아님) */
export const TRADE_CORRIDORS: Array<{ id: string; name: string; points: LonLat[] }> = [
  {
    id: "far-east-europe",
    name: "Far East → Europe",
    points: [
      { lon: 121.5, lat: 31.2 },
      { lon: 108, lat: 10 },
      { lon: 103.85, lat: 1.29 },
      { lon: 88, lat: 6 },
      { lon: 43.5, lat: 12.5 },
      { lon: 32.5, lat: 31.2 },
      { lon: 12, lat: 37 },
      { lon: 8.8, lat: 53.1 },
    ],
  },
  {
    id: "far-east-na-west",
    name: "Far East → NA West",
    points: [
      { lon: 121.5, lat: 31.2 },
      { lon: 145, lat: 35 },
      { lon: -170, lat: 45 },
      { lon: -140, lat: 45 },
      { lon: -122, lat: 37 },
    ],
  },
  {
    id: "far-east-na-east",
    name: "Far East → NA East",
    points: [
      { lon: 121.5, lat: 31.2 },
      { lon: 103.85, lat: 1.29 },
      { lon: 88, lat: 6 },
      { lon: 43.5, lat: 12.5 },
      { lon: 32.5, lat: 31.2 },
      { lon: -6, lat: 40 },
      { lon: -66, lat: 44 },
    ],
  },
  {
    id: "europe-na",
    name: "Europe → NA",
    points: [
      { lon: 8.8, lat: 53.1 },
      { lon: -6, lat: 47 },
      { lon: -40, lat: 45 },
      { lon: -66, lat: 44 },
    ],
  },
  {
    id: "europe-middle-east",
    name: "Europe → Middle East",
    points: [
      { lon: 12, lat: 37 },
      { lon: 24, lat: 34 },
      { lon: 32.5, lat: 31.2 },
      { lon: 38.5, lat: 19 },
      { lon: 51, lat: 24 },
    ],
  },
  {
    id: "south-africa-europe",
    name: "South Africa → Europe",
    points: [
      { lon: 18.5, lat: -34.3 },
      { lon: 10, lat: -15 },
      { lon: -6, lat: 40 },
      { lon: 8.8, lat: 53.1 },
    ],
  },
  {
    id: "mexico-na",
    name: "Mexico → NA",
    points: [
      { lon: -97, lat: 20 },
      { lon: -88, lat: 26 },
      { lon: -80, lat: 26 },
      { lon: -71, lat: 40 },
    ],
  },
  {
    id: "china-worldwide",
    name: "China → Worldwide",
    points: [
      { lon: 121.5, lat: 31.2 },
      { lon: 114, lat: 18 },
      { lon: 103.85, lat: 1.29 },
    ],
  },
  {
    id: "oceania-asia",
    name: "Oceania → Asia",
    points: [
      { lon: 151, lat: -34 },
      { lon: 130, lat: -12 },
      { lon: 103.85, lat: 1.29 },
    ],
  },
];

export const REGION_LABELS: Record<FleetRegion, string> = {
  EAST_ASIA: "East Asia",
  SOUTHEAST_ASIA_INDIAN: "Southeast Asia / Indian Ocean",
  MIDDLE_EAST_RED_SEA: "Middle East / Red Sea",
  EUROPE_MEDITERRANEAN: "Europe / Mediterranean",
  NORTH_AMERICA: "North America",
  LATIN_AMERICA: "Latin America",
  AFRICA: "Africa",
  OCEANIA: "Oceania",
};
