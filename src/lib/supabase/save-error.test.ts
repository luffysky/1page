import { afterEach, describe, expect, it, vi } from "vitest";

import { describeSaveError } from "./save-error";

/**
 * 存檔失敗要留下痕跡（0818）
 *
 * ── 這一組在守什麼 ────────────────────────────────────────────
 *
 * 0818 的事故：使用者按「存到我的帳號」，畫面上只有「存檔失敗。」，
 * 而資料庫其實把原因講得一清二楚（外鍵撞了，因為那個帳號沒有 profile）。
 * 應用層把它整個丟掉，結果**沒有任何人有辦法查**。
 *
 * 所以這裡釘兩件事：
 *   1. 原始錯誤一定要被記下來（少了這一行，下一次一樣查不到）
 *   2. 給使用者的那句話不能含資料表名／欄位名／約束名
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe("describeSaveError", () => {
  it("⚠️ 一定會把原始錯誤記下來", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    describeSaveError("saveThing", { message: "boom", code: "XX000" }, "存檔失敗。");

    expect(spy, "原始錯誤沒有被記下來——下一次一樣查不到").toHaveBeenCalledOnce();
    const [label, payload] = spy.mock.calls[0]!;
    expect(String(label)).toContain("saveThing");
    expect(payload).toMatchObject({ message: "boom", code: "XX000" });
  });

  it("⚠️ 給使用者的那句話不含 schema 細節", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const raw =
      'insert or update on table "crm_definitions" violates foreign key constraint "crm_definitions_owner_id_fkey"';
    const message = describeSaveError("saveThing", { message: raw, code: "23503" }, "存檔失敗。");

    // 這正是 0818 那次真實的錯誤字串
    for (const leak of ["crm_definitions", "owner_id", "constraint", "insert or update"]) {
      expect(message, `訊息裡洩漏了 ${leak}`).not.toContain(leak);
    }
    expect(message).toBe("存檔失敗。");
  });

  it("上限的訊息本來就是寫給人看的，直接轉出去", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      describeSaveError(
        "saveThing",
        { message: "每個帳號最多只能存 10 份 CRM 設計" },
        "存檔失敗。",
      ),
    ).toContain("10 份");
    expect(
      describeSaveError("saveThing", { message: "一份 CRM 最多只能存 500 筆記錄" }, "存檔失敗。"),
    ).toContain("500 筆");
  });

  it("重複與約束違反給得出使用者做得到的下一步", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    // 「換一個」是他做得到的事；「違反唯一索引」不是
    expect(describeSaveError("x", { message: "dup", code: "23505" }, "存檔失敗。")).toContain(
      "換一個",
    );
    expect(describeSaveError("x", { message: "chk", code: "23514" }, "存檔失敗。")).toContain(
      "檢查",
    );
  });

  it("不認得的錯誤回那句籠統的，而不是猜一個", () => {
    /*
     * 猜錯的指示比沒有指示更糟：使用者會照著做，然後發現沒有用。
     * 不認得就說不認得，而真正的原因已經在伺服器的紀錄裡了。
     */
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(describeSaveError("x", { message: "??", code: "08006" }, "存檔失敗。")).toBe(
      "存檔失敗。",
    );
  });
});
