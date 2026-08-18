import { z } from "zod";

/**
 * 訪客自己設計的 CRM 結構（CR-003-5 / Spec §47）
 *
 * ── 這與後台的 CRM 是兩件完全不同的東西 ──────────────────────
 *
 * `features/backoffice` 是**我們自己**的客戶管理，表是我們設計的。
 * 這裡是訪客在前台自己畫一個 CRM 出來，資料進 `crm_definitions`。
 * 兩邊不共用資料表，也刻意不共用命名——這個專案已經兩次踩到
 * 「同一個字兩個意思」，兩次都得回頭寫警告。
 *
 * ── ⚠️ 絕對不拿這份定義去下 DDL ──────────────────────────────
 *
 * 「他定義一張表，我們就 create table」等於把 DDL 權限交給不可信輸入：
 *   - 表名來自使用者輸入
 *   - 每個使用者一組表，改一個欄位就是一次線上 migration
 *   - 幾百個使用者之後，schema 裡有幾千張沒有人看得懂的表
 *
 * 一張表配 jsonb 就夠，RLS 也只要一條（`owner_id = auth.uid()`）。
 * 代價是查詢能力弱——但這是「設計一個 CRM 給自己用」，不是資料倉儲。
 *
 * ── 這份 schema 就是驗證器本身 ────────────────────────────────
 *
 * 與 SiteConfig（3A）同一套心智模型：jsonb 欄位保證的只有
 * 「這是合法 JSON」，不保證「這是合法的 CrmDefinition」。
 * 所以**寫進去之前驗一次，讀出來之後再驗一次**。
 * 只驗寫入的話，任何繞過應用層的路徑（或我們自己之後改壞的程式）
 * 都會讓前台拿到一份形狀不對的定義，然後在渲染時炸掉。
 */

/** 上限存在的理由是「一個人可以用瀏覽器把資料庫寫爆」，不是美學 */
export const CRM_LIMITS = {
  entities: 8,
  fieldsPerEntity: 20,
  optionsPerField: 20,
  /** 每個定義能存幾筆記錄。真正的邊界在資料庫的 trigger，這裡是給人看的 */
  recordsPerDefinition: 500,
} as const;

/**
 * 欄位型別。
 *
 * ⚠️ 刻意**沒有**「關聯到另一個實體」這種型別。
 * 那會把這份 jsonb 變成一個要維護參照完整性的迷你資料庫——
 * 而刪掉被參照的那一筆時要怎麼辦，是一個沒有好答案的問題。
 * 需要關聯的人要的其實是一個真的資料庫，不是這個。
 */
export const CRM_FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "checkbox",
] as const;

export type CrmFieldType = (typeof CRM_FIELD_TYPES)[number];

export const CRM_FIELD_TYPE_LABELS: Record<CrmFieldType, string> = {
  text: "單行文字",
  textarea: "多行文字",
  number: "數字",
  date: "日期",
  select: "下拉選單",
  checkbox: "勾選",
};

/**
 * id 由我們產生，不收使用者輸入的。
 *
 * 使用者可以改的是 label（顯示的名字）。id 一旦讓使用者決定，
 * 改名字就會變成「換掉一個 key」——而已經存進去的記錄還掛在舊 key 上，
 * 於是那些資料就從畫面上消失了，沒有任何錯誤訊息。
 */
const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id 只能是小寫英數與連字號")
  .max(40);

const optionSchema = z.string().trim().min(1, "選項不能是空的").max(60);

export const crmFieldSchema = z
  .object({
    id: idSchema,
    label: z.string().trim().min(1, "欄位要有名字").max(60),
    type: z.enum(CRM_FIELD_TYPES),
    required: z.boolean().default(false),
    /** 只有 select 用得到。其他型別給了也留著沒有意義，所以直接清掉（見 refine） */
    options: z.array(optionSchema).max(CRM_LIMITS.optionsPerField).default([]),
    /** 輸入框下面那一行小字。留空就不顯示 */
    hint: z.string().trim().max(120).default(""),
  })
  .refine((field) => field.type !== "select" || field.options.length > 0, {
    message: "下拉選單至少要有一個選項",
    path: ["options"],
  })
  .refine((field) => new Set(field.options).size === field.options.length, {
    message: "選項不可以重複",
    path: ["options"],
  });

export type CrmField = z.infer<typeof crmFieldSchema>;

export const crmEntitySchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1, "這一類要有名字").max(60),
    fields: z.array(crmFieldSchema).max(CRM_LIMITS.fieldsPerEntity),
  })
  .refine(
    (entity) => new Set(entity.fields.map((field) => field.id)).size === entity.fields.length,
    {
      message: "欄位 id 重複",
      path: ["fields"],
    },
  );

export type CrmEntity = z.infer<typeof crmEntitySchema>;

export const crmDefinitionSchema = z
  .object({
    name: z.string().trim().min(1, "這份 CRM 要有名字").max(80),
    entities: z.array(crmEntitySchema).min(1, "至少要有一類").max(CRM_LIMITS.entities),
  })
  .refine(
    (definition) =>
      new Set(definition.entities.map((entity) => entity.id)).size === definition.entities.length,
    { message: "類別 id 重複", path: ["entities"] },
  );

export type CrmDefinition = z.infer<typeof crmDefinitionSchema>;

export type CrmValidation =
  | { ok: true; definition: CrmDefinition }
  | { ok: false; errors: { path: string; message: string }[] };

/**
 * 唯一的入口。
 *
 * 回傳錯誤清單而不是丟例外：這份東西的來源是使用者正在編的表單，
 * 「哪一個欄位不對」本身就是要顯示給他看的資訊。
 */
export function validateCrmDefinition(input: unknown): CrmValidation {
  const parsed = crmDefinitionSchema.safeParse(input);

  if (parsed.success) return { ok: true, definition: parsed.data };

  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

/**
 * 一筆記錄的值。
 *
 * ⚠️ 這裡**不是**一份固定的 schema——它由使用者的定義算出來。
 * 那正是這整個功能的重點，也是為什麼記錄不能拆成關聯表。
 *
 * 未知的 key 一律丟掉（不是報錯）：定義改過之後，舊記錄上會留著
 * 已經被刪掉的欄位。報錯的話那筆記錄從此打不開；
 * 丟掉的話它只是少顯示一格，而使用者可以繼續編。
 */
export function recordSchemaFor(entity: CrmEntity) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of entity.fields) {
    /*
     * ⚠️ checkbox 在這裡就處理完，不進下面的「必填／選填」分支。
     *
     * 沒勾的 checkbox **根本不會出現在 FormData 裡**，所以「缺席」
     * 就是它的 false。當成選填的話，沒勾等於沒有這個 key，
     * 而畫面上讀不到 key 時顯示的是空白——使用者看到的是
     * 「我明明取消勾選了，它變成一片空白」而不是「否」。
     */
    if (field.type === "checkbox") {
      shape[field.id] = z.preprocess(
        (raw) => raw === true || raw === "true" || raw === "on",
        z.boolean(),
      );
      continue;
    }

    let value: z.ZodTypeAny;

    switch (field.type) {
      case "number":
        /*
         * ⚠️ 先把空字串換成 undefined。
         *
         * `z.coerce.number()` 會把 "" 變成 **0**（`Number("")` 是 0），
         * 於是「沒填」會安靜地存成一個 0——而在一份記價格或數量的
         * CRM 裡，那個 0 看起來完全正常。
         */
        value = z.preprocess(
          (raw) => (raw === "" || raw === null ? undefined : raw),
          z.coerce.number().finite(),
        );
        break;
      case "date":
        value = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式要是 YYYY-MM-DD");
        break;
      case "select":
        // 只收定義裡有的選項。不擋的話，改 HTML 就能寫進任意字串
        value = z.enum(field.options as [string, ...string[]]);
        break;
      /*
       * ⚠️ 必填的文字欄位要 `.min(1)`。
       *
       * 空字串**過得了** `z.string()`——於是「必填」在伺服器端等於沒有，
       * 而瀏覽器的 required 只要按一下 F12 就沒了。
       * 表現是一筆每一格都空白、卻通過驗證的記錄。
       * （e2e 的「必填沒填就存不進去」抓到的就是這個。）
       */
      case "textarea":
        value = field.required
          ? z.string().trim().min(1, "不能空著").max(2000)
          : z.string().max(2000);
        break;
      default:
        value = field.required
          ? z.string().trim().min(1, "不能空著").max(300)
          : z.string().max(300);
    }

    /*
     * 選填的欄位也要把空字串當成「沒填」。
     *
     * 不轉的話，一個選填的日期欄位留白會拿到 ""，而 `""` 過不了
     * `YYYY-MM-DD` 的檢查——使用者會被一個他根本沒碰的欄位擋下來。
     */
    shape[field.id] = field.required
      ? value
      : z.preprocess((raw) => (raw === "" ? undefined : raw), value.optional());
  }

  return z.object(shape).strip();
}
