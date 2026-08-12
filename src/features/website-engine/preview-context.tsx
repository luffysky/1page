"use client";

import { createContext, useContext, useMemo, useReducer } from "react";

import {
  type AccentId,
  buildSiteConfig,
  draftFromTemplate,
  getTemplate,
  type SiteDraft,
  TEMPLATES,
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
  | { type: "select-template"; templateId: string }
  | { type: "set-theme"; themeId: ThemeId }
  | { type: "set-accent"; accentId: AccentId }
  | { type: "set-brand-name"; value: string }
  | { type: "set-industry"; value: string }
  | { type: "set-device"; device: Device };

function reducer(state: PreviewState, action: PreviewAction): PreviewState {
  switch (action.type) {
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
