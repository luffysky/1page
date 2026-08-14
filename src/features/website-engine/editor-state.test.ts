import { describe, expect, it } from "vitest";

import { editorStateSchema, storedEditorStateSchema } from "./editor-state";
import { editorStateOf, type PreviewState, stateFromStored } from "./preview-context";
import { buildSiteConfig, draftFromTemplate, TEMPLATES } from "./templates";

/**
 * 編輯器狀態的持久化（CR-003-4）
 *
 * 這一組守的是一件很安靜的事：**存進去的東西載得回來**。
 *
 * 第一版的 saved_sites 存的是 `buildSiteConfig()` 算出來的成品。
 * 存檔會成功、清單列得出來、每一條測試都綠——只是那份東西
 * 永遠打不開，因為成品裡沒有「當初選的是哪一套模板」。
 * 那個資訊在算出成品的那一刻就被丟掉了。
 */

function sampleState(): PreviewState {
  const template = TEMPLATES[0]!;
  return {
    draft: draftFromTemplate(template),
    device: "desktop",
    edited: { brandName: true, industry: false },
    sections: null,
    history: { past: [], future: [] },
    savedSiteId: null,
  };
}

/**
 * 刻意**不**持久化的 state 欄位。每一個都要寫理由。
 *
 * 這份清單存在的原因是下面那條測試要反過來問「有沒有哪個欄位沒人存」。
 * 少了它，新增一個欄位卻忘了存的表現是「那個設定跳一次頁就沒了」，
 * 不會報錯、不會紅，使用者只覺得這個編輯器有時候會忘記事情。
 */
const NOT_PERSISTED: Record<string, string> = {
  device: "「現在想怎麼看」不是訪客累積的設定；回訪時停在手機模式比較像壞掉",
  history: "存的是結果不是過程；能復原到上一次瀏覽的中間狀態對使用者沒有意義",
  savedSiteId: "「存在哪一列」不是這份文件的一部分；只有 sessionStorage 那一版要帶",
};

describe("編輯器狀態的持久化", () => {
  it("state 的每一個欄位，不是被存起來就是列在不存的理由清單裡", () => {
    /*
     * 反過來問「有沒有漏」，不是逐一列「這幾個要存」。
     * 後者每次新增欄位都要記得補，前者會自己發現下一次。
     */
    const state = sampleState();
    const stored = new Set(Object.keys(editorStateOf(state)));
    // draft 是攤平存的（五個純量各自一個欄位），所以要往下看一層
    const draftKeys = Object.keys(state.draft);

    const missing = Object.keys(state).filter((key) => {
      if (key in NOT_PERSISTED) return false;
      if (key === "draft") return !draftKeys.every((inner) => stored.has(inner));
      return !stored.has(key);
    });

    expect(missing, `這些欄位沒有被存起來，也沒有寫下不存的理由：${missing.join("、")}`).toEqual(
      [],
    );
  });

  it("存起來再讀回來是同一個 state", () => {
    const state = sampleState();
    const restored = stateFromStored({
      ...editorStateOf(state),
      savedSiteId: state.savedSiteId,
    });

    expect(restored).toEqual(state);
  });

  it("編輯器存出來的欄位與 schema 認得的欄位完全一致", () => {
    /*
     * 兩個方向都要對。
     *
     * 存了 schema 不認得的欄位 → 讀回來時被 zod 丟掉，而且沒有任何跡象。
     * schema 要求編輯器給不出來的欄位 → 每一次存檔都失敗。
     */
    expect(Object.keys(editorStateOf(sampleState())).sort()).toEqual(
      Object.keys(editorStateSchema.shape).sort(),
    );
  });

  it("sessionStorage 版本只比資料庫版本多一個 savedSiteId", () => {
    const extra = Object.keys(storedEditorStateSchema.shape).filter(
      (key) => !(key in editorStateSchema.shape),
    );

    expect(extra).toEqual(["savedSiteId"]);
  });

  it("每一套模板的預設狀態都存得進去", () => {
    for (const template of TEMPLATES) {
      const state: PreviewState = { ...sampleState(), draft: draftFromTemplate(template) };
      const result = editorStateSchema.safeParse(editorStateOf(state));

      expect(result.success, `${template.id} 的預設狀態存不進去`).toBe(true);
    }
  });

  it("經過 JSON 一趟之後仍然是同一份東西", () => {
    // 真正的儲存路徑是 JSON 字串，不是物件。undefined 與 Date 之類的東西
    // 會在這一趟消失，而消失的欄位在讀回來時只是「使用者的設定不見了」。
    const document = editorStateOf(sampleState());
    const parsed = editorStateSchema.parse(JSON.parse(JSON.stringify(document)));

    expect(parsed).toEqual(document);
  });

  it("算出來的成品不能當成編輯器狀態存回去", () => {
    /*
     * 這一條就是第一版的 bug 本身。
     *
     * SiteConfig 是輸入的函數，反過來推不回去——它沒有 templateId、
     * 沒有 themeId，只有已經算好的顏色。所以「存成品」這件事
     * 從結構上就不可能載得回來，而不是漏寫了哪一段程式。
     */
    const config = buildSiteConfig(draftFromTemplate(TEMPLATES[0]!));

    expect(editorStateSchema.safeParse(config).success).toBe(false);
  });
});
