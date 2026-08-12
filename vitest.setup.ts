import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 未開啟 vitest globals，RTL 的自動 cleanup 不會生效，這裡明確掛上。
afterEach(cleanup);

/**
 * sessionStorage 也要跟著清。
 *
 * 4D 讓 Template Experience 把訪客調過的設定存進 sessionStorage，
 * 好讓他離開頁面再回來時不用重選。副作用是**同一個檔案裡的測試會互相污染**：
 * 前一條測試切到 Local Business，下一條測試掛載時就會「還原」成那個狀態，
 * 於是它的起點不是預設值——而失敗訊息會完全看不出原因在上一條測試。
 *
 * 卸載狀態屬於測試框架的職責，不是每個測試檔各自記得要做的事。
 */
afterEach(() => {
  if (typeof globalThis.sessionStorage !== "undefined") globalThis.sessionStorage.clear();
});
