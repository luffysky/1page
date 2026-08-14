import { resolveSection, variantsFor } from "./registry";
import {
  type SectionBackground,
  type SiteConfig,
  type SiteSection,
  validateSiteConfig,
} from "./schema";

/**
 * Section 操作（Spec §22 / Phase 6C）
 *
 * ── 唯一的規則：失敗不留下半毀的 SiteConfig ──────────────────
 *
 * 每個操作都是**純函式**：吃一份 config，回傳一份新的，或者回傳失敗。
 * 沒有任何一個函式會就地修改傳進來的那份。
 *
 * 為什麼這件事值得整個檔案都圍著它轉：這些操作的呼叫端是模型的 tool call，
 * 而模型會傳出不存在的 section id、重複的 id、超出範圍的順序。
 * 如果失敗的操作留下一份改到一半的 config，訪客看到的是一個
 * 「少了一塊、而且沒人知道為什麼」的網站——而且下一個操作會從那個
 * 壞掉的狀態繼續往下改。
 *
 * 產生的結果一律再過一次 schema。純函式寫對了不代表結果合法：
 * 例如把 section 加到第 31 個，型別上完全正確，schema 上超過上限。
 */

export type SectionOpResult = { ok: true; config: SiteConfig } | { ok: false; error: string };

/** 收尾：驗證後才算成功。任何一步出錯都回原本那份，呼叫端拿不到半成品 */
function finalize(candidate: SiteConfig): SectionOpResult {
  const duplicates = new Set<string>();
  const seen = new Set<string>();
  for (const section of candidate.sections) {
    if (seen.has(section.id)) duplicates.add(section.id);
    seen.add(section.id);
  }

  if (duplicates.size > 0) {
    // 重複的 id 會讓之後的更新與刪除指向錯誤對象——
    // 那是最難查的一種，因為畫面看起來是對的。
    return { ok: false, error: `section id 重複：${[...duplicates].join("、")}` };
  }

  const validated = validateSiteConfig(candidate);
  if (!validated.ok) {
    return { ok: false, error: validated.errors.map((issue) => issue.message).join("；") };
  }

  return { ok: true, config: validated.config };
}

function indexOfSection(config: SiteConfig, id: string): number {
  return config.sections.findIndex((section) => section.id === id);
}

export function addSection(
  config: SiteConfig,
  section: SiteSection,
  position?: number,
): SectionOpResult {
  if (indexOfSection(config, section.id) >= 0) {
    return { ok: false, error: `已經有一個 id 是 ${section.id} 的區塊` };
  }

  // 未知的 type/variant 在渲染時會降級成佔位，畫面上看起來像少了東西。
  // 那個降級是給「已經存在的舊資料」用的安全網，不是給新增用的。
  if (!resolveSection(section)) {
    return { ok: false, error: `沒有 ${section.type} 這種區塊` };
  }

  const sections = [...config.sections];
  const at =
    position === undefined ? sections.length : Math.max(0, Math.min(position, sections.length));
  sections.splice(at, 0, section);

  return finalize({ ...config, sections });
}

export function removeSection(config: SiteConfig, id: string): SectionOpResult {
  const index = indexOfSection(config, id);
  if (index < 0) return { ok: false, error: `找不到 id 是 ${id} 的區塊` };

  return finalize({
    ...config,
    sections: config.sections.filter((section) => section.id !== id),
  });
}

export function reorderSections(config: SiteConfig, order: readonly string[]): SectionOpResult {
  // 要求完整排列，不接受部分。只給一部分的話，剩下的要放哪裡就得由我們猜，
  // 而猜錯的表現是「有一塊莫名其妙跑到最後面」。
  const current = config.sections.map((section) => section.id);

  if (order.length !== current.length || new Set(order).size !== order.length) {
    return { ok: false, error: `順序必須包含全部 ${current.length} 個區塊，且不可重複` };
  }

  const unknown = order.filter((id) => !current.includes(id));
  if (unknown.length > 0) return { ok: false, error: `找不到這些區塊：${unknown.join("、")}` };

  const byId = new Map(config.sections.map((section) => [section.id, section]));

  return finalize({ ...config, sections: order.map((id) => byId.get(id)!) });
}

export function updateSectionContent(
  config: SiteConfig,
  id: string,
  content: SiteSection["content"],
): SectionOpResult {
  const index = indexOfSection(config, id);
  if (index < 0) return { ok: false, error: `找不到 id 是 ${id} 的區塊` };

  const sections = [...config.sections];
  // 合併而非取代：模型通常只想改標題，沒有必要因此把整段內容重打一次
  // ——而重打一次就有機會把別的欄位弄丟。
  sections[index] = {
    ...sections[index]!,
    content: { ...sections[index]!.content, ...content },
  };

  return finalize({ ...config, sections });
}

export function setSectionVariant(
  config: SiteConfig,
  id: string,
  variant: string,
): SectionOpResult {
  const index = indexOfSection(config, id);
  if (index < 0) return { ok: false, error: `找不到 id 是 ${id} 的區塊` };

  const section = config.sections[index]!;
  const available = variantsFor(section.type);

  if (!available.includes(variant)) {
    // 講出有哪些，模型才改得動。只說「不對」它會再猜一個。
    return {
      ok: false,
      error: `${section.type} 沒有 ${variant} 這種排版。可用的有：${available.join("、")}`,
    };
  }

  const sections = [...config.sections];
  sections[index] = { ...section, variant };

  return finalize({ ...config, sections });
}

/**
 * 換一塊的背景（CR-004 / Phase B BJ）。
 *
 * ⚠️ 整份取代，不是合併。
 *
 * 與 `updateSectionContent` 相反，而那個相反是刻意的：內容是很多欄位，
 * 改標題不該把說明弄丟；背景則是**一個選擇**——選了「純色」之後，
 * 上一次那張圖不該還留在資料裡，不然存出去的設定會帶著一個
 * 沒有任何地方會用到、但下一個讀的人看得到的網址。
 *
 * 要保留哪些值由 `switchBackgroundType` 決定，那是介面層的事。
 */
export function setSectionBackground(
  config: SiteConfig,
  id: string,
  background: SectionBackground | undefined,
): SectionOpResult {
  const index = indexOfSection(config, id);
  if (index < 0) return { ok: false, error: `找不到 id 是 ${id} 的區塊` };

  const sections = [...config.sections];
  const section = { ...sections[index]! };

  if (!background || background.type === "none") {
    // 沒有背景就把欄位整個拿掉，不要留一個 { type: "none" } 在那裡
    delete section.background;
  } else {
    section.background = background;
  }

  sections[index] = section;

  return finalize({ ...config, sections });
}

/**
 * 重設（Spec §22 `reset_preview`）。
 *
 * 「可逆或可重設」裡的可重設。上面每個操作都是純函式，
 * 所以呼叫端只要留著原本那份就能還原——但訪客要的不是逐步復原，
 * 是一鍵回到乾淨的狀態。
 */
export function resetSections(config: SiteConfig, original: SiteConfig): SectionOpResult {
  return finalize({ ...config, sections: original.sections });
}
