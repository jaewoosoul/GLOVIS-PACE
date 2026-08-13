import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";

/** DecisionPdfTemplate의 Page 컴포넌트 1장 높이(px, 96dpi 기준 A4) — 캡처 크기를 이 배수로 강제 고정한다. */
const PAGE_PX_HEIGHT = 1123;

/**
 * DOM 엘리먼트를 그대로 캡처해 PDF로 저장한다. jsPDF 기본 폰트는 한글 글리프가 없어 텍스트를
 * 직접 그리면 깨지므로, 브라우저가 렌더링한 화면을 이미지로 캡처해 PDF에 붙여넣는 방식을 쓴다
 * (html2canvas → jsPDF). 캡처 대상은 A4 비율에 맞춰 스타일링된 컴포넌트여야 한다.
 * 원조 html2canvas가 아니라 html2canvas-pro를 쓴다 — Tailwind v4가 색상을 oklch()로 생성하는데
 * 원조 패키지는 이 함수를 못 읽어 캡처가 조용히 실패한다(html2canvas-pro는 oklch/lab/lch 지원).
 *
 * 캡처 크기를 html2canvas의 자동 감지에 맡기면 폰트/레이아웃이 캡처 순간까지 완전히 자리잡았는지에
 * 따라 실제 픽셀 높이가 미세하게 흔들릴 수 있고, 그 오차가 페이지 경계를 넘으면 슬라이싱 루프가
 * 빈 페이지를 하나 더 만들거나(부동소수 잔여값 > 0) 여러 페이지 내용이 한 페이지에 눌려 나온다.
 * Page 컴포넌트는 항상 PAGE_PX_HEIGHT의 정확한 배수 높이로 고정 렌더되므로, 실제 DOM 높이를
 * 그 배수로 반올림해 캡처 크기 자체를 명시적으로 강제한다.
 */
export async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void> {
  // 폰트가 아직 로딩 중이면 줄바꿈/글자 폭이 최종본과 달라 캡처 높이가 어긋날 수 있다.
  await document.fonts.ready;

  const rect = el.getBoundingClientRect();
  const pageCount = Math.max(1, Math.round(rect.height / PAGE_PX_HEIGHT));
  const captureWidth = Math.round(rect.width);
  const captureHeight = pageCount * PAGE_PX_HEIGHT;

  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth,
    windowHeight: captureHeight,
  });

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  // PNG는 무손실이라 텍스트 위주 문서에서도 수 MB까지 커진다 — 이메일로 보고하기엔 너무 크므로
  // JPEG(품질 0.85)로 압축한다. 텍스트/UI 요소는 단색이 대부분이라 화질 저하가 거의 안 보인다.
  const imgData = canvas.toDataURL("image/jpeg", 0.85);
  const imgWidth = pageWidth;
  // 캡처 높이를 PAGE_PX_HEIGHT 배수로 고정했으므로, 이미지 높이도 pageHeight의 정확한 배수다 —
  // 루프가 while+잔여값 비교 대신 정해진 pageCount만큼만 반복해 경계 오차가 생길 여지가 없다.
  const imgHeight = pageHeight * pageCount;

  for (let page = 0; page < pageCount; page += 1) {
    if (page > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, -page * pageHeight, imgWidth, imgHeight);
  }

  pdf.save(filename);
}
