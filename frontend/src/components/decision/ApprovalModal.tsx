import { CheckCircle2 } from "lucide-react";

/**
 * 승인 확정 직후 1.5~2초간 표시되는 자동 소멸 토스트.
 * 별도의 '확인' 버튼 클릭 없이 짧은 시간 뒤 선대 관제 화면으로 자동 이동한다.
 */
export function ApprovalModal({
  title = "GLOVIS-E 운항 변경안이 승인되었습니다.",
  description = "선대 관제 화면에서 실행 상태를 확인할 수 있습니다.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-emerald-200 bg-white px-5 py-3 shadow-xl">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
        <p className="text-sm text-gray-800">
          <span className="font-bold">{title}</span>
          <br />
          {description}
        </p>
      </div>
    </div>
  );
}
