import { AppRouter } from "./AppRouter";
// 완료된 판단을 리포트 이력으로 자동 기록하는 구독자 — 화면 어디서도 직접 import하지 않으므로
// 앱 진입점에서 한 번 로드해 등록한다(decisionStore와의 순환 의존을 피하려 반대 방향으로 구독한다).
import "../calculations/reportRecordBuilder";

function App() {
  return <AppRouter />;
}

export default App;
