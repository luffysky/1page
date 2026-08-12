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
}

type PreviewAction =
  | { type: "restore"; state: PreviewState }
  | { type: "select-template"; templateId: string }
  | { type: "set-theme"; themeId: ThemeId }
  | { type: "set-accent"; accentId: AccentId }
  | { type: "set-brand-name"; value: string }
  | { type: "set-industry"; value: string }
  | { type: "set-device"; device: Device };

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
  }
}

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

  const { edited, ...draft } = result.data;
  return { draft, edited, device: "desktop" };
}

function writeStoredState(state: PreviewState): void {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state.draft, edited: state.edited }),
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
      config: buildSiteConfig(state.draft),
      template: getTemplate(state.draft.templateId) ?? TEMPLATES[0]!,
      selectTemplate: (templateId) => dispatch({ type: "select-template", templateId }),
      setTheme: (themeId) => dispatch({ type: "set-theme", themeId }),
      setAccent: (accentId) => dispatch({ type: "set-accent", accentId }),
      setBrandName: (value) => dispatch({ type: "set-brand-name", value }),
      setIndustry: (value) => dispatch({ type: "set-industry", value }),
      setDevice: (device) => dispatch({ type: "set-device", device }),
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
