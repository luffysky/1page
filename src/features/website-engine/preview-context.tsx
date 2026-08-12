"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { z } from "zod";

import {
  ACCENT_IDS,
  type AccentId,
  buildSiteConfig,
  draftFromTemplate,
  getTemplate,
  type SiteDraft,
  TEMPLATES,
  THEME_IDS,
  type ThemeId,
  type WebsiteTemplate,
} from "./templates";
import { addSection, removeSection, reorderSections } from "./section-ops";
import { newSection } from "./section-presets";
import { siteSectionSchema, type SiteSection } from "./schema";
import type { Device, SiteConfig } from "./types";

/**
 * Template Experience 的狀態（Spec §8.15 / §15）
 *
 * ── 唯一的規則 ────────────────────────────────────────────────
 *
 *   User Click → SiteConfig Patch → SiteRenderer → Preview
 *
 * Spec §8.15 明文禁止直接操作 DOM style，而 V3 Demo 正是用
 * `element.style.background = ...` 偽造主題切換（Spec §45.1）。
 * 這裡的作法讓那件事**在結構上做不到**：外界能改的只有一份 draft，
 * 畫面則是 `buildSiteConfig(draft)` 的結果。沒有任何一條路徑可以只改畫面。
 *
 * ── 為什麼狀態是 draft 而不是 SiteConfig ─────────────────────
 *
 * 見 templates/index.ts 的 SiteDraft 說明：存 config 的話「換主題」
 * 就變成「記得同時改 theme.colors 的五個欄位」，漏一個的表現是
 * 「換了主題但按鈕還是舊顏色」。draft 是五個純量，算得出唯一的 config。
 */

interface PreviewState {
  draft: SiteDraft;
  device: Device;
  /**
   * 訪客是否自己改過這個欄位。
   *
   * 用途只有一個：換模板時，沒被改過的欄位跟著新模板的預設走，
   * 改過的保留。少了這個，訪客打完自己的店名再換一套版型，
   * 名字就變回「晴日咖啡」——那是他剛剛才輸入的東西。
   */
  edited: { brandName: boolean; industry: boolean };
  /**
   * 被編輯過的區塊（CR-003-4）。`null` 代表「還是模板原本那組」。
   *
   * ── 為什麼這個不能像 theme 一樣從 draft 算出來 ────────────────
   *
   * 上面那段說「狀態是 draft 不是 config」，理由是 config 算得出來，
   * 存 config 會存到一份可能與程式碼分歧的快照。那個理由對主題成立，
   * 對這裡**不成立**：使用者把「常見問題」搬到「團隊」前面之後，
   * 沒有任何一組純量算得出那個順序。它是輸入，不是衍生物。
   *
   * 所以規則其實一直是同一條——**存輸入，不存衍生物**。
   * 主題是衍生物（存 draft），排好的區塊是輸入（存這裡）。
   *
   * null 而不是一開始就複製一份模板區塊：這樣「還沒動過」與
   * 「動過但剛好長得一樣」分得出來，換模板時才知道該不該覆蓋。
   */
  sections: SiteSection[] | null;
}

type PreviewAction =
  | { type: "restore"; state: PreviewState }
  | { type: "select-template"; templateId: string }
  | { type: "set-theme"; themeId: ThemeId }
  | { type: "set-accent"; accentId: AccentId }
  | { type: "set-brand-name"; value: string }
  | { type: "set-industry"; value: string }
  | { type: "set-device"; device: Device }
  | { type: "apply-patch"; patch: Record<string, unknown> }
  | { type: "move-section"; id: string; direction: "up" | "down" }
  | { type: "remove-section"; id: string }
  | { type: "add-section"; sectionType: SiteSection["type"]; afterId: string | null }
  | { type: "reset-sections" };

function reducer(state: PreviewState, action: PreviewAction): PreviewState {
  switch (action.type) {
    case "restore":
      // device 不還原：那是「現在想怎麼看」，不是訪客累積的設定。
      // 回到頁面時停在上次的手機模式，比較像是壞掉。
      return { ...action.state, device: state.device };

    case "select-template": {
      const template = getTemplate(action.templateId);
      // 未知 id 一律當作沒發生。切換模板不該有「切到一半」的狀態。
      if (!template) return state;

      const defaults = draftFromTemplate(template);

      return {
        ...state,
        draft: {
          ...defaults,
          brandName: state.edited.brandName ? state.draft.brandName : defaults.brandName,
          industry: state.edited.industry ? state.draft.industry : defaults.industry,
        },
        /*
         * 換模板一定清掉區塊覆寫。
         *
         * 這與品牌名的處理**刻意相反**：名字是使用者自己打的一個字串，
         * 換版型時該留著。區塊順序則是綁在特定一套模板上的——
         * 保留舊模板的區塊等於換了版型卻沒換內容，那不是換模板。
         */
        sections: null,
      };
    }

    case "set-theme":
      return { ...state, draft: { ...state.draft, themeId: action.themeId } };

    case "set-accent":
      return { ...state, draft: { ...state.draft, accentId: action.accentId } };

    case "set-brand-name":
      return {
        ...state,
        draft: { ...state.draft, brandName: action.value },
        edited: { ...state.edited, brandName: true },
      };

    case "set-industry":
      return {
        ...state,
        draft: { ...state.draft, industry: action.value },
        edited: { ...state.edited, industry: true },
      };

    case "set-device":
      return { ...state, device: action.device };

    /*
     * Agent 送過來的變更（Spec §21）。
     *
     * ⚠️ 走**同一個 reducer**，不是另外一條路徑。
     * 「AI 改的」與「訪客自己按的」如果各有一套更新邏輯，兩者遲早會分歧——
     * 而分歧的表現是「AI 換的模板不會保留我剛打的店名」。
     *
     * 內容當作不可信輸入：來源是模型的 tool call，經過 server 驗過一次，
     * 但這裡是狀態的擁有者，該自己再確認一次。
     */
    /*
     * 區塊操作（CR-003-4）。
     *
     * 一律走 section-ops 的純函式，不在這裡自己動陣列。
     * 那些函式失敗時回 { ok: false } 且**不會動到傳進去的 config**，
     * 所以「移動失敗」的表現是畫面沒變，而不是半毀的順序。
     */
    case "move-section": {
      const current = sectionsOf(state);
      const index = current.findIndex((section) => section.id === action.id);
      if (index === -1) return state;

      const target = action.direction === "up" ? index - 1 : index + 1;
      // 已經在頭或尾就是沒事發生。不要繞回另一端——
      // 那會讓「一直按下移」把區塊從最底下跳到最上面。
      if (target < 0 || target >= current.length) return state;

      const order = current.map((section) => section.id);
      [order[index], order[target]] = [order[target]!, order[index]!];

      const result = reorderSections(configOf(state), order);
      return result.ok ? { ...state, sections: result.config.sections } : state;
    }

    case "add-section": {
      const current = sectionsOf(state);
      const section = newSection(
        action.sectionType,
        current.map((item) => item.id),
      );

      /*
       * 加在選取那一塊的後面，不是永遠加在最下面。
       *
       * 使用者選了「關於」再按「新增常見問題」，他要的是加在關於旁邊。
       * 一律加到最底下的話，他得再按十次下移——而頁尾永遠在最後，
       * 新區塊會出現在頁尾**下面**，看起來像壞了。
       */
      const at = action.afterId ? current.findIndex((item) => item.id === action.afterId) : -1;
      const position = at === -1 ? undefined : at + 1;

      const result = addSection(configOf(state), section, position);
      return result.ok ? { ...state, sections: result.config.sections } : state;
    }

    case "remove-section": {
      const result = removeSection(configOf(state), action.id);
      return result.ok ? { ...state, sections: result.config.sections } : state;
    }

    case "reset-sections":
      return { ...state, sections: null };

    case "apply-patch": {
      const { patch } = action;

      if (patch.reset === true) {
        const template = getTemplate(state.draft.templateId);
        // 重設回目前模板的原始樣子，包含被改過的品牌名——
        // 「重來」的意思是全部重來，留一半下來更難理解。
        return template
          ? {
              ...state,
              draft: draftFromTemplate(template),
              edited: { brandName: false, industry: false },
              sections: null,
            }
          : state;
      }

      const next = { ...state.draft };
      const edited = { ...state.edited };

      if (typeof patch.templateId === "string" && getTemplate(patch.templateId)) {
        const template = getTemplate(patch.templateId)!;
        const defaults = draftFromTemplate(template);
        // 與訪客自己換模板同樣的規則：改過的欄位保留，沒改過的跟著新模板走。
        next.templateId = defaults.templateId;
        next.themeId = defaults.themeId;
        next.accentId = defaults.accentId;
        if (!edited.brandName) next.brandName = defaults.brandName;
        if (!edited.industry) next.industry = defaults.industry;
      }

      if (isThemeId(patch.themeId)) next.themeId = patch.themeId;
      if (isAccentId(patch.accentId)) next.accentId = patch.accentId;

      if (typeof patch.brandName === "string" && patch.brandName.trim()) {
        next.brandName = patch.brandName;
        edited.brandName = true;
      }

      if (typeof patch.industry === "string" && patch.industry.trim()) {
        next.industry = patch.industry;
        edited.industry = true;
      }

      return { ...state, draft: next, edited };
    }
  }
}

const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);

/* ------------------------------------------------------------------ */
/* draft + 區塊覆寫 → SiteConfig                                       */
/* ------------------------------------------------------------------ */

/**
 * 目前該顯示的區塊。
 *
 * 沒被編輯過（`sections === null`）就用模板算出來的那一組，
 * 所以模板文案改版之後，沒動過區塊的訪客會拿到新版——
 * 這正是「不存衍生物」想保住的性質。動過的人才拿自己那一份。
 */
function sectionsOf(state: PreviewState) {
  return state.sections ?? buildSiteConfig(state.draft).sections;
}

/**
 * 完整的 SiteConfig。
 *
 * ⚠️ 主題、品牌、字型仍然一律由 draft 算，**只有 sections 會被覆寫**。
 * 這樣「換主題」依然不可能只改一半——那個保證是 draft 換來的，
 * 加了區塊編輯之後也不能弄丟。
 */
function configOf(state: PreviewState): SiteConfig {
  const base = buildSiteConfig(state.draft);
  return state.sections ? { ...base, sections: state.sections } : base;
}

const isAccentId = (value: unknown): value is AccentId =>
  typeof value === "string" && (ACCENT_IDS as readonly string[]).includes(value);

/* ------------------------------------------------------------------ */
/* 跨頁保存（Spec §8.15「訪客累積的設定不會在跳轉時消失」）            */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "1page:preview-draft";

/**
 * 存 draft，不存 SiteConfig。
 *
 * config 是 draft 的函數，存 config 等於存了一份可能與程式碼分歧的快照：
 * 模板文案改過之後，回來的訪客會看到舊版的內容，而且沒有任何跡象。
 * draft 是六個純量，重新算一次就是最新的。
 *
 * ⚠️ sessionStorage 的內容是**不可信輸入**——使用者可以直接編輯它。
 * 因此讀回來一律過 schema，而不是 `JSON.parse` 之後就當成 SiteDraft。
 */
const storedStateSchema = z.object({
  templateId: z.string().min(1).max(64),
  themeId: z.enum(THEME_IDS),
  accentId: z.enum(ACCENT_IDS),
  brandName: z.string().max(200),
  industry: z.string().max(200),
  edited: z.object({ brandName: z.boolean(), industry: z.boolean() }),
  /*
   * 排好的區塊要存。
   *
   * 上面說「存 draft 不存 config」，但那條規則真正的內容是
   * **存輸入、不存衍生物**。使用者搬過的區塊順序沒有任何純量算得出來，
   * 它是輸入。不存的話，Spec §8.15 的「訪客累積的設定不會在跳轉時消失」
   * 對整個編輯器都不成立——他排了十分鐘，點一下作品頁就全沒了。
   *
   * 一樣過 schema：sessionStorage 是使用者改得動的不可信輸入。
   */
  sections: z.array(siteSectionSchema).max(30).nullable().default(null),
});

function readStoredState(): PreviewState | null {
  let raw: string | null = null;

  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // Safari 無痕模式等情境下存取 storage 會拋例外。
    // 保存是加分項，不該讓整個 Preview 掛掉。
    return null;
  }

  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const result = storedStateSchema.safeParse(parsed);
  if (!result.success) return null;

  // 模板可能在這次瀏覽之後被移除。指向不存在的模板就當作沒存過。
  if (!getTemplate(result.data.templateId)) return null;

  /*
   * ⚠️ 明確一個一個取，不要用 `const { edited, ...draft } = result.data`。
   *
   * 那種寫法在 schema 只有 draft 欄位時是對的，但每加一個非 draft 欄位
   * （這次是 sections）就會被 rest 掃進 draft 裡，變成 draft 上一個
   * 不該存在的欄位。它不會報錯，只會讓 buildSiteConfig 收到多餘的東西。
   */
  const { edited, sections, ...draft } = result.data;
  return { draft, edited, sections, device: "desktop" };
}

function writeStoredState(state: PreviewState): void {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state.draft, edited: state.edited, sections: state.sections }),
    );
  } catch {
    // 同上：存不進去就算了，不影響當下的操作。
  }
}

export interface SitePreviewValue extends PreviewState {
  /** draft 的唯一衍生物。Preview 顯示的就是這一份 */
  config: SiteConfig;
  template: WebsiteTemplate;
  selectTemplate: (templateId: string) => void;
  setTheme: (themeId: ThemeId) => void;
  setAccent: (accentId: AccentId) => void;
  setBrandName: (value: string) => void;
  setIndustry: (value: string) => void;
  setDevice: (device: Device) => void;
  /** Agent 送過來的變更（Spec §21）。走與訪客操作同一個 reducer */
  applyPatch: (patch: Record<string, unknown>) => void;
  /* 區塊編輯（CR-003-4）。拖曳與鍵盤按鈕呼叫的是同一組函式 */
  moveSection: (id: string, direction: "up" | "down") => void;
  removeSection: (id: string) => void;
  addSection: (type: SiteSection["type"], afterId: string | null) => void;
  resetSections: () => void;
  /** 有沒有動過區塊結構。用來決定要不要顯示「回到模板原樣」 */
  sectionsEdited: boolean;
}

const SitePreviewContext = createContext<SitePreviewValue | null>(null);

/**
 * `initialTemplateId` 由 server 依 `?goal=` 決定，
 * 首次輸出就是對的那一套，不需要等 client 再校正一次。
 */
export function SitePreviewProvider({
  initialTemplateId,
  children,
}: {
  initialTemplateId?: string;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, initialTemplateId, (id) => ({
    draft: draftFromTemplate(getTemplate(id ?? "") ?? TEMPLATES[0]!),
    device: "desktop" as Device,
    edited: { brandName: false, industry: false },
    sections: null,
  }));

  /*
   * 還原只在掛載時做一次。
   *
   * 為什麼不在 useReducer 的初始值裡直接讀 sessionStorage：
   * server 沒有 sessionStorage，首次渲染的輸出會與 client 不一致，
   * 那是 hydration mismatch。代價是回訪時會有一瞬間顯示 server 那一版——
   * 只影響「改過設定又離開再回來」的人，而讓首頁 hydration 出錯影響的是所有人。
   */
  useEffect(() => {
    const stored = readStoredState();
    if (stored) dispatch({ type: "restore", state: stored });
  }, []);

  /*
   * ⚠️ 初始狀態**不寫回** storage。
   *
   * 兩個 effect 都在掛載時跑，而 dispatch 要等下一次 render 才生效——
   * 若無條件寫入，掛載當下寫進去的就是「server 給的預設值」，
   * 把訪客上次存的東西蓋掉。React StrictMode 會把 effect 跑兩次，
   * 於是第二次還原讀到的正是剛剛被蓋掉的預設值，訪客的設定就這樣消失。
   *
   * 實際撞到過：e2e 的「離開首頁再回來」一直拿到預設的品牌名稱。
   * 以物件識別判斷「有沒有任何變更（含還原）」，沒有變更就不動 storage。
   */
  const initialState = useRef(state);
  useEffect(() => {
    if (state === initialState.current) return;
    writeStoredState(state);
  }, [state]);

  const value = useMemo<SitePreviewValue>(
    () => ({
      ...state,
      config: configOf(state),
      template: getTemplate(state.draft.templateId) ?? TEMPLATES[0]!,
      selectTemplate: (templateId) => dispatch({ type: "select-template", templateId }),
      setTheme: (themeId) => dispatch({ type: "set-theme", themeId }),
      setAccent: (accentId) => dispatch({ type: "set-accent", accentId }),
      setBrandName: (value) => dispatch({ type: "set-brand-name", value }),
      setIndustry: (value) => dispatch({ type: "set-industry", value }),
      setDevice: (device) => dispatch({ type: "set-device", device }),
      applyPatch: (patch) => dispatch({ type: "apply-patch", patch }),
      moveSection: (id, direction) => dispatch({ type: "move-section", id, direction }),
      removeSection: (id) => dispatch({ type: "remove-section", id }),
      addSection: (sectionType, afterId) => dispatch({ type: "add-section", sectionType, afterId }),
      resetSections: () => dispatch({ type: "reset-sections" }),
      sectionsEdited: state.sections !== null,
    }),
    [state],
  );

  return <SitePreviewContext.Provider value={value}>{children}</SitePreviewContext.Provider>;
}

export function useSitePreview(): SitePreviewValue {
  const context = useContext(SitePreviewContext);
  if (!context) {
    throw new Error("useSitePreview 必須在 <SitePreviewProvider> 之內使用");
  }
  return context;
}
