// M1 Step 1: 最小限のエントリポイント（骨組みのみ）。
// 認証、API通信、画面構成（App.tsx等）は Step 10・11 で実装する（実装指示書4章）。
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('#root element not found');
}

createRoot(container).render(<div>Whiteface (M1 Step 1 skeleton)</div>);
