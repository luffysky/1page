"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";

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
import {
  addSection,
  removeSection,
  reorderSections,
  setSectionVariant,
  updateSectionContent,
} from "./section-ops";
import { newSection } from "./section-presets";
import { type EditorState, type StoredEditorState, storedEditorStateSchema } from "./editor-state";
import type { SiteSection } from "./schema";
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

export interface PreviewState {
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
  /**
   * 復原用的歷史（CR-003-4 第四段）。
   *
   * 只記 sections，不記整個 state——復原的是「我剛剛動的那一下」，
   * 不是「換過的主題色」。把主題也塞進歷史的話，按一次復原會同時
   * 把顏色改回去，那不是使用者按那顆按鈕時想要的。
   *
   * 存在 state 裡而不是元件裡，是因為 reducer 是唯一會改 sections 的地方。
   * 放在元件裡就得在每個呼叫點記得推一筆，而漏掉的那個就是
   * 「這一步復原不了」——沒有任何徵兆。
   */
  history: { past: (SiteSection[] | null)[]; future: (SiteSection[] | null)[] };
  /**
   * 正在編輯哪一份存檔（`null` ＝ 還沒存過）。
   *
   * 沒有這個欄位的話，「存到我的帳號」永遠是新增一列：載入自己存的草稿、
   * 改一個字、再按存檔，帳號裡就多一份幾乎一樣的東西，二十份的上限
   * 會被自己的修改記錄塞滿。
   */
  savedSiteId: string | null;
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
  | { type: "reset-sections" }
  | { type: "update-content"; id: string; content: SiteSection["content"] }
  | { type: "set-variant"; id: string; variant: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "set-saved-site"; id: string | null };

/** 會改到 sections、因此要進歷史的動作 */
const SECTION_ACTIONS = new Set([
  "move-section",
  "remove-section",
  "add-section",
  "update-content",
  "set-variant",
  "reset-sections",
]);

/** 歷史最多留這麼多步。無上限的話一直打字會把 sessionStorage 撐爆 */
const MAX_HISTORY = 50;

/**
 * 在 reducer 外面包一層記錄歷史。
 *
 * ⚠️ 放在這裡而不是每個 case 裡面：漏掉任何一個 case 的後果是
 * 「那一步復原不了」，而那件事不會報錯、測試也不會紅——
 * 使用者按了復原，畫面跳回更早的狀態，他會以為復原壞了。
 *
 * 包一層之後，新增一種區塊操作只要把名字加進 SECTION_ACTIONS，
 * 忘了加的表現是那一步不進歷史——仍然要靠測試抓，但至少
 * 不必在每個 case 重複同一段程式。
 */
function reducer(state: PreviewState, action: PreviewAction): PreviewState {
  if (action.type === "undo") {
    const previous = state.history.past.at(-1);
    if (previous === undefined) return state;

    return {
      ...state,
      sections: previous,
      history: {
        past: state.history.past.slice(0, -1),
        future: [state.sections, ...state.history.future].slice(0, MAX_HISTORY),
      },
    };
  }

  if (action.type === "redo") {
    const next = state.history.future[0];
    if (next === undefined) return state;

    return {
      ...state,
      sections: next,
      history: {
        past: [...state.history.past, state.sections].slice(-MAX_HISTORY),
        future: state.history.future.slice(1),
      },
    };
  }

  const result = baseReducer(state, action);

  // 沒有真的改到 sections 就不記一筆——否則按了無效的操作
  // （例如第一塊再往上移）也會多一步空的歷史，復原起來像卡住。
  if (!SECTION_ACTIONS.has(action.type) || result.sections === state.sections) {
    return result;
  }

  return {
    ...result,
    history: {
      past: [...state.history.past, state.sections].slice(-MAX_HISTORY),
      // 做了新動作就把 redo 清掉——分岔的歷史沒有人想得清楚
      future: [],
    },
  };
}

function baseReducer(state: PreviewState, action: PreviewAction): PreviewState {
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

    case "update-content": {
      const result = updateSectionContent(configOf(state), action.id, action.content);
      /*
       * 失敗就當作沒發生。最常見的失敗是使用者貼進了含 HTML 標籤的字
       * （schema 的 plainText 擋下來），那時畫面不變比顯示半套內容好。
       */
      return result.ok ? { ...state, sections: result.config.sections } : state;
    }

    case "set-variant": {
      const result = setSectionVariant(configOf(state), action.id, action.variant);
      return result.ok ? { ...state, sections: result.config.sections } : state;
    }

    case "reset-sections":
      return { ...state, sections: null };

    /*
     * 存檔成功之後回報「這份現在是哪一列」。
     *
     * 第一次存檔完不記下來的話，第二次按存檔又會新增一列——
     * 使用者按兩次存檔就得到兩份，而畫面上完全看不出為什麼。
     */
    case "set-saved-site":
      return state.savedSiteId === action.id ? state : { ...state, savedSiteId: action.id };

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

    /*
     * undo / redo 在上面那層就處理掉了，走不到這裡。
     * 需要這個分支只是為了讓 switch 窮盡——TypeScript 認得 action 的聯集型別，
     * 少一個分支它就會說「這個函式可能沒有回傳值」。
     */
    default:
      return state;
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
 * 存輸入，不存 SiteConfig。
 *
 * config 是 draft 的函數，存 config 等於存了一份可能與程式碼分歧的快照：
 * 模板文案改過之後，回來的訪客會看到舊版的內容，而且沒有任何跡象。
 *
 * ⚠️ 形狀定義在 `editor-state.ts`，與資料庫那一份共用同一個 schema。
 * 分成兩份的時候，這裡存輸入、資料庫存成品，結果是「存得進去、載不回來」。
 */

/**
 * 把持久化的文件變回 state。
 *
 * device 不還原：那是「現在想怎麼看」，不是訪客累積的設定。
 * history 也不存——存的是**結果**，不是過程。存歷史的話回訪時可以
 * 「復原」到上一次瀏覽的中間狀態，那對使用者沒有意義，
 * 而且儲存量會隨著編輯次數無上限成長。
 */
export function stateFromStored(stored: StoredEditorState): PreviewState {
  /*
   * ⚠️ 明確一個一個取，不要用 `const { edited, ...draft } = stored`。
   *
   * 那種寫法在 schema 只有 draft 欄位時是對的，但每加一個非 draft 欄位
   * （目前是 sections 與 savedSiteId）就會被 rest 掃進 draft 裡，
   * 變成 draft 上一個不該存在的欄位。它不會報錯，
   * 只會讓 buildSiteConfig 收到多餘的東西。
   */
  const { edited, sections, savedSiteId, ...draft } = stored;
  return {
    draft,
    edited,
    sections,
    savedSiteId,
    device: "desktop",
    history: { past: [], future: [] },
  };
}

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

  const result = storedEditorStateSchema.safeParse(parsed);
  if (!result.success) return null;

  // 模板可能在這次瀏覽之後被移除。指向不存在的模板就當作沒存過。
  if (!getTemplate(result.data.templateId)) return null;

  return stateFromStored(result.data);
}

/**
 * state → 可持久化的文件。
 *
 * `savedSiteId` 不在裡面：那是「這份東西存在哪一列」，不是這份東西的一部分。
 * 資料庫存的就是這個形狀（那一列自己的 id 已經是答案），
 * sessionStorage 才需要多帶一個。
 */
export function editorStateOf(state: PreviewState): EditorState {
  return { ...state.draft, edited: state.edited, sections: state.sections };
}

function storedFromState(state: PreviewState): StoredEditorState {
  return { ...editorStateOf(state), savedSiteId: state.savedSiteId };
}

function writeStoredState(state: PreviewState): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(storedFromState(state)));
  } catch {
    // 同上：存不進去就算了，不影響當下的操作。
  }
}

export interface SitePreviewValue extends PreviewState {
  /** draft 的唯一衍生物。Preview 顯示的就是這一份 */
  config: SiteConfig;
  /** 要存起來的那一份（存檔與 sessionStorage 共用同一個形狀） */
  editorState: EditorState;
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
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  updateContent: (id: string, content: SiteSection["content"]) => void;
  setVariant: (id: string, variant: string) => void;
  resetSections: () => void;
  /** 有沒有動過區塊結構。用來決定要不要顯示「回到模板原樣」 */
  sectionsEdited: boolean;
  /** 存檔成功後回報這份是哪一列；「另存新的一份」則傳 null */
  setSavedSite: (id: string | null) => void;
}

const SitePreviewContext = createContext<SitePreviewValue | null>(null);

/**
 * `initialTemplateId` 由 server 依 `?goal=` 決定，
 * 首次輸出就是對的那一套，不需要等 client 再校正一次。
 *
 * `initialState` 是 server 從 `saved_sites` 載回來的那一份（`/edit?draft=<id>`）。
 * 它比 sessionStorage 優先——使用者剛剛在會員中心點的是「編輯這一份」，
 * 拿別的東西給他看是最糟的一種結果。
 */
export function SitePreviewProvider({
  initialTemplateId,
  initialState: loaded,
  children,
}: {
  initialTemplateId?: string;
  initialState?: StoredEditorState;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(
    reducer,
    { initialTemplateId, loaded },
    ({ initialTemplateId: id, loaded: fromServer }): PreviewState =>
      fromServer
        ? stateFromStored(fromServer)
        : {
            draft: draftFromTemplate(getTemplate(id ?? "") ?? TEMPLATES[0]!),
            device: "desktop" as Device,
            edited: { brandName: false, industry: false },
            sections: null,
            history: { past: [], future: [] },
            savedSiteId: null,
          },
  );

  /*
   * 還原只在掛載時做一次。
   *
   * 為什麼不在 useReducer 的初始值裡直接讀 sessionStorage：
   * server 沒有 sessionStorage，首次渲染的輸出會與 client 不一致，
   * 那是 hydration mismatch。代價是回訪時會有一瞬間顯示 server 那一版——
   * 只影響「改過設定又離開再回來」的人，而讓首頁 hydration 出錯影響的是所有人。
   *
   * ⚠️ server 已經給了一份指定的草稿就不要還原。載入 A 卻看到 B，
   * 而且 B 會在下一次存檔時把 A 蓋掉——那是會弄丟東西的錯，不只是看錯。
   * `loaded` 來自 server props，同一次掛載內不會變，所以這個 effect
   * 仍然只跑一次。
   */
  const fromServer = loaded !== undefined;
  useEffect(() => {
    if (fromServer) return;
    const stored = readStoredState();
    if (stored) dispatch({ type: "restore", state: stored });
  }, [fromServer]);

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
   *
   * 例外是 server 指定的草稿：那不是「預設值」，是使用者明確點開的那一份，
   * 要立刻蓋掉 sessionStorage。不蓋的話，載入 A 之後沒改任何東西就離開，
   * 再回到 /edit 會看到上次那份未存的東西——而他以為自己在編輯 A。
   */
  const initialState = useRef(state);
  useEffect(() => {
    if (state === initialState.current && !fromServer) return;
    writeStoredState(state);
  }, [state, fromServer]);

  const value = useMemo<SitePreviewValue>(
    () => ({
      ...state,
      config: configOf(state),
      editorState: editorStateOf(state),
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
      updateContent: (id, content) => dispatch({ type: "update-content", id, content }),
      setVariant: (id, variant) => dispatch({ type: "set-variant", id, variant }),
      resetSections: () => dispatch({ type: "reset-sections" }),
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      canUndo: state.history.past.length > 0,
      canRedo: state.history.future.length > 0,
      sectionsEdited: state.sections !== null,
      setSavedSite: (id) => dispatch({ type: "set-saved-site", id }),
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
