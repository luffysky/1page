import { describe, expect, it } from "vitest";

import { startingDefinition } from "./ops";
import { type CrmEntity, recordSchemaFor, validateCrmDefinition } from "./schema";

/**
 * CRM 定義與記錄的驗證（CR-003-5）
 *
 * ── 這一組在守什麼 ────────────────────────────────────────────
 *
 * `crm_definitions.definition` 與 `crm_records.data` 都是 jsonb。
 * jsonb 保證的只有「這是合法 JSON」——形狀由這份 schema 保證，
 * 而它是**唯一**的驗證點。
 *
 * ⚠️ 這裡釘的是「schema 擋不擋得住不合法的輸入」，
 * 不是「目前有幾種欄位型別」。後者下週就會過期。
 */

const entity: CrmEntity = {
  id: "thing-1",
  name: "東西",
  fields: [
    { id: "text-1", label: "名字", type: "text", required: true, options: [], hint: "" },
    { id: "num-1", label: "數量", type: "number", required: false, options: [], hint: "" },
    // ⚠️ 必填的數字要單獨有一個。選填的那個在外層就被轉成 undefined 了，
    // 走不到「coerce 把空字串變成 0」那條路——用它來驗等於沒驗
    { id: "num-2", label: "價格", type: "number", required: true, options: [], hint: "" },
    { id: "date-1", label: "日期", type: "date", required: false, options: [], hint: "" },
    {
      id: "sel-1",
      label: "狀態",
      type: "select",
      required: false,
      options: ["新的", "舊的"],
      hint: "",
    },
    { id: "chk-1", label: "重要", type: "checkbox", required: false, options: [], hint: "" },
  ],
};

describe("定義本身是不可信輸入", () => {
  it("不是物件的東西一律擋下來", () => {
    for (const bad of [null, "字串", 42, [], undefined]) {
      expect(validateCrmDefinition(bad).ok, `${JSON.stringify(bad)} 沒被擋下來`).toBe(false);
    }
  });

  it("下拉選單沒有選項就不合法", () => {
    // 存得進去的話，畫面上會出現一個永遠選不到東西的下拉選單
    const broken = {
      name: "壞的",
      entities: [
        {
          id: "a-1",
          name: "A",
          fields: [{ id: "s-1", label: "狀態", type: "select", required: false, options: [] }],
        },
      ],
    };

    expect(validateCrmDefinition(broken).ok).toBe(false);
  });

  it("欄位 id 重複就不合法", () => {
    /*
     * 重複的 id 會讓記錄的 key 撞在一起：兩個欄位寫同一格，
     * 而畫面上兩欄顯示的是同一個值——那是最難查的一種，
     * 因為它看起來只是「使用者填錯了」。
     */
    const broken = {
      name: "壞的",
      entities: [
        {
          id: "a-1",
          name: "A",
          fields: [
            { id: "same", label: "一", type: "text" },
            { id: "same", label: "二", type: "text" },
          ],
        },
      ],
    };

    expect(validateCrmDefinition(broken).ok).toBe(false);
  });

  it("一類都沒有就不合法", () => {
    expect(validateCrmDefinition({ name: "空的", entities: [] }).ok).toBe(false);
  });

  it("錯誤訊息說得出是哪裡不對", () => {
    const result = validateCrmDefinition({ name: "", entities: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.every((issue) => issue.message.length > 0)).toBe(true);
    }
  });
});

describe("記錄的 schema 由使用者的定義算出來", () => {
  const schema = recordSchemaFor(entity);

  const filled = { "text-1": "阿明", "num-2": "100" };

  it("必填就是必填", () => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse(filled).success).toBe(true);
  });

  it("必填的文字欄位收不了空字串", () => {
    /*
     * ⚠️ 空字串**過得了** `z.string()`。
     *
     * 所以少了 `.min(1)` 的話，「必填」在伺服器端等於不存在——
     * 而瀏覽器那個 required 只要按一下 F12 就沒了。
     * 表現是一筆每一格都空白、卻通過驗證的記錄。
     *
     * 這個洞是 e2e 抓到的，不是這一層。補在這裡是因為
     * 這一層跑一次要一秒，e2e 那一條要一分鐘。
     */
    expect(schema.safeParse({ "text-1": "", "num-2": "1" }).success).toBe(false);

    // 只有空白也一樣。全形空白同理（trim 處理得掉）
    expect(schema.safeParse({ "text-1": "   ", "num-2": "1" }).success).toBe(false);
  });

  it("下拉選單只收定義裡有的選項", () => {
    // 不擋的話，改一下 HTML 就能寫進任意字串——
    // 而那個值之後會出現在使用者自己的清單裡，看起來像是他打的
    expect(schema.safeParse({ ...filled, "sel-1": "新的" }).success).toBe(true);
    expect(schema.safeParse({ ...filled, "sel-1": "偷塞的" }).success).toBe(false);
  });

  it("沒填的數字欄位不會變成 0", () => {
    /*
     * `z.coerce.number()` 會把 "" 變成 0（`Number("")` 是 0）。
     * 在一份記價格或數量的 CRM 裡，那個 0 看起來完全正常——
     * 這是「安靜地存錯」最典型的樣子。
     *
     * ⚠️ **必填**的那一個才是真正的考題。選填的欄位在外層就被
     * 轉成 undefined 了，根本走不到 coerce——第一版這條測試
     * 用的是選填欄位，把 preprocess 整個拿掉它照樣綠。
     *
     * 必填 + 空字串的正確結果是**擋下來**（那是「沒填」），
     * 不是存一個 0 進去。
     */
    expect(schema.safeParse({ "text-1": "a", "num-2": "" }).success).toBe(false);

    // 選填的那一個：空字串就是沒填，不是 0
    const parsed = schema.parse({ ...filled, "num-1": "" });
    expect(parsed["num-1"]).toBeUndefined();
  });

  it("沒填的日期不會被當成格式錯誤", () => {
    // 不轉的話，一個使用者根本沒碰的選填欄位會把整張表單擋下來
    expect(schema.safeParse({ ...filled, "date-1": "" }).success).toBe(true);
    expect(schema.safeParse({ ...filled, "date-1": "2026/08/18" }).success).toBe(false);
  });

  it("沒勾的 checkbox 是 false，不是「沒有這個 key」", () => {
    // 缺席的話，畫面上讀不到 key 顯示的是空白——
    // 使用者看到的是「我取消勾選，它變成一片空白」而不是「否」
    expect(schema.parse(filled)["chk-1"]).toBe(false);
    expect(schema.parse({ ...filled, "chk-1": "on" })["chk-1"]).toBe(true);
  });

  it("定義裡沒有的 key 丟掉，不是報錯", () => {
    /*
     * 定義改過之後，舊記錄上會留著已經被刪掉的欄位。
     * 報錯的話那筆記錄從此打不開；丟掉的話它只是少顯示一格。
     */
    const parsed = schema.parse({ ...filled, 已經刪掉的欄位: "殘留" });
    expect(parsed).not.toHaveProperty("已經刪掉的欄位");
  });

  it("預設那一份的每個欄位都填得完", () => {
    // 反過來問：預設定義有沒有哪個欄位是「畫得出來但填不進去」的
    const base = startingDefinition();
    const first = base.entities[0]!;
    const values = Object.fromEntries(
      first.fields.map((field) => [
        field.id,
        field.type === "select"
          ? field.options[0]
          : field.type === "date"
            ? "2026-08-18"
            : field.type === "number"
              ? "1"
              : field.type === "checkbox"
                ? "on"
                : "測試",
      ]),
    );

    expect(recordSchemaFor(first).safeParse(values).success).toBe(true);
  });
});
