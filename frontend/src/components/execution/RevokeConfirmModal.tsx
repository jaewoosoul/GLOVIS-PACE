export function RevokeConfirmModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">결정을 철회하시겠습니까?</h3>
        <p className="mt-2 text-sm text-gray-600">
          철회하면 실행 상태가 초기화되고 운항 판단 화면으로 돌아갑니다. 지연 가정과 속도 옵션을 다시 선택할 수
          있습니다.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-md bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            철회 확정
          </button>
        </div>
      </div>
    </div>
  );
}
