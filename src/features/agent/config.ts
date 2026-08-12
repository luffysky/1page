/**
 * Agent 的模型設定與額度（Spec §16 / §36 / §37）
 *
 * 這個檔案**不含任何秘密**，因此瀏覽器端也能引用——
 * 5E 的輸入框要顯示「還剩幾則」「單則上限幾字」，那些數字必須與
 * server 實際執行的檢查是同一份，否則畫面說可以送、server 說太長。
 */

/**
 * 模型。
 *
 * ⚠️ 這是會產生費用的設定，換之前先想清楚。
 * Opus 5 是目前最強的一階，輸入 $5 / 輸出 $25 每百萬 token。
 * 對「免費、匿名、任何人都能用」的顧問來說，這是整個 V1 最容易失控的成本。
 *
 * 選它而不是更便宜的一階，是因為這個 Agent 要做的事不只是回答問答集：
 * 它要判斷意圖、決定該不該深入、避免把 Demo 講成客戶案例（Spec §8.12）、
 * 並在 Phase 6 操作 SiteConfig。判斷錯的代價是講錯話給潛在客戶聽。
 *
 * 成本的控制手段放在別處，不是降級模型：
 *   - 系統提示走 prompt caching（見 system-prompt.ts）
 *   - effort 設在 medium 而非預設的 high
 *   - 輸入以字數上限截斷，輸出以 max_tokens 封頂
 *   - 5E 會加上 IP 與 session 的速率限制
 */
export const AGENT_MODEL = "claude-opus-5";

/**
 * 思考深度。
 *
 * ⚠️ 刻意**不關閉** thinking。
 * Opus 5 在 thinking 關閉時有兩個已知的失敗樣態：
 * 工具呼叫可能以純文字寫在回覆裡（那一輪看起來成功、工具其實沒跑，
 * 而且沒有任何錯誤），以及 `<thinking>` 標籤漏進使用者看得到的內容。
 * 前者對 Phase 6 的 SiteConfig 工具是致命的——會靜靜地什麼都沒做。
 *
 * 控制成本的正確旋鈕是 effort，不是關掉思考。
 */
export const AGENT_EFFORT = "medium" as const;

export const AGENT_LIMITS = {
  /** 單則訊息字數上限（Spec §36 input length limit） */
  maxMessageChars: 2_000,

  /** 單一 session 的訊息則數上限（Spec §37 message/session limit） */
  maxMessages: 40,

  /**
   * 整段對話的字數上限（Spec §36 conversation budget）。
   *
   * 用字數而不是 token：token 數要多打一次 API 才知道，
   * 而這個檢查必須在**送出之前**就能做完——否則「超額」的判斷本身也要花錢。
   * 字數是保守的代理值，中文一字約一個 token 以上，英文更少，
   * 因此以字數設限只會比預期更早擋下，不會更晚。
   */
  maxConversationChars: 24_000,

  /**
   * 單次回覆的輸出上限。
   *
   * 這是 thinking + 回覆文字的**合計**上限，不是只有回覆。
   * 設太小的表現是「講到一半斷掉」，而那會被誤認為是網路問題。
   */
  maxOutputTokens: 8_000,

  /** 單次請求的逾時。超過就是明確的 timeout，不是無聲卡住 */
  requestTimeoutMs: 90_000,

  /**
   * 一次回覆最多幾輪工具呼叫（Spec §20）。
   *
   * 這不是防呆，是成本上限：「模型查了作品 → 看了結果又去查模板 → 再查 FAQ」
   * 每一輪都是一次完整的請求。沒有上限的話，一個問題可以無限往下滾。
   * 四輪足夠讓它查完手上四個工具還有餘裕。
   */
  maxToolRounds: 4,
} as const;

/**
 * 速率限制的兩層視窗（Spec §36 / §37）。
 *
 * 短視窗擋「連按送出」與腳本狂打；長視窗擋「一整個下午慢慢刷」。
 * 只有短視窗的話，每分鐘打滿也能一天打幾千次；
 * 只有長視窗的話，前三十秒就能把一小時的額度用光。
 *
 * 放在 config 而不是 rate-limit.ts：那個檔案是 server-only，
 * 而測試與畫面都需要知道這些數字。
 */
export const AGENT_RATE_LIMITS = [
  { windowMs: 60_000, max: 8 },
  { windowMs: 60 * 60_000, max: 60 },
] as const;

/**
 * 錯誤碼。
 *
 * 5A 的出口條件是「逾時、中斷、超額都有明確行為，不是無聲失敗」。
 * 明確的意思是：每一種失敗都有一個代號，前端能據此說出**人看得懂的那句話**，
 * 而不是統一顯示「發生錯誤」。
 */
export const AGENT_ERROR_CODES = [
  /** 沒有設定 ANTHROPIC_API_KEY。不是「AI 壞了」，是還沒接上 */
  "not_configured",
  /** 請求不符合 schema */
  "invalid_request",
  /** 單則太長 */
  "message_too_long",
  /** 整段對話超過預算 */
  "conversation_exhausted",
  /** 訊息則數超過上限 */
  "too_many_messages",
  /** 上游限流 */
  "rate_limited",
  /** 上游暫時不可用 */
  "upstream_unavailable",
  /** 逾時 */
  "timeout",
  /** 模型拒絕回應（Spec §36 prompt injection / 安全分類器） */
  "refused",
  /** 回覆被輸出上限截斷 */
  "truncated",
  /** 工具來回次數達上限（Spec §20 的成本上限） */
  "tool_loop",
] as const;

export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number];

/** 給使用者看的說明。不是給工程師看的 stack trace */
export const AGENT_ERROR_MESSAGES: Record<AgentErrorCode, string> = {
  not_configured: "AI 顧問還沒啟用。這是設定還沒完成，不是你的操作有問題。",
  invalid_request: "這次的請求格式不正確，請重新整理頁面再試一次。",
  message_too_long: `一次講太多了，請縮短到 ${AGENT_LIMITS.maxMessageChars} 字以內。`,
  conversation_exhausted: "這段對話已經很長了。開一段新的對話會比較清楚，也比較快。",
  too_many_messages: "這段對話的則數已達上限。開一段新的對話繼續聊。",
  rate_limited: "現在同時使用的人有點多，請稍等一下再送出。",
  upstream_unavailable: "AI 服務暫時無法回應，這是對方那側的狀況，稍後會恢復。",
  timeout: "這次回覆花的時間超過上限，已經中止。可以換個問法再試一次。",
  refused: "這個問題我沒辦法回答。換個方式問，或直接留下聯絡方式讓真人回覆你。",
  truncated: "回覆太長被截斷了。可以請我針對其中一段再說清楚一點。",
  tool_loop: "我查了太多次還是沒整理出答案。換個問法，或直接留下聯絡方式讓真人回覆你。",
};
