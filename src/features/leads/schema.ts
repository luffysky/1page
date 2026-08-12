import { z } from "zod";

/**
 * Lead Schema（Spec §19）
 *
 * ⚠️ 這裡的每一個欄位都是**真人給的資訊**，其中信箱與電話是個資。
 * 因此兩件事必須同時成立：
 *   - 全部選填。逼人一次填完只會讓他離開，而半份需求也是需求
 *   - 進資料庫之前一律驗過。這條路徑的來源是模型的 tool call，
 *     而模型會生出格式不對的東西——那是常態，不是例外
 */

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const leadSchema = z.object({
  contact: z
    .object({
      name: shortText(80).optional(),
      // 寬鬆驗證：擋掉明顯不是信箱的東西就好。
      // 嚴格的信箱正規表示式會擋掉合法的地址，而那個代價是「聯絡不到人」。
      email: z.string().trim().max(200).email("信箱格式不正確").optional(),
      phone: shortText(40).optional(),
    })
    .optional(),

  business: z
    .object({
      name: shortText(120).optional(),
      industry: shortText(60).optional(),
      description: shortText(1000).optional(),
    })
    .optional(),

  requirement: z
    .object({
      service: z.array(shortText(40)).max(8).optional(),
      goal: shortText(500).optional(),
      deadline: shortText(80).optional(),
      budgetRange: shortText(80).optional(),
    })
    .optional(),

  assets: z
    .object({
      logo: z.boolean().optional(),
      photos: z.boolean().optional(),
      copy: z.boolean().optional(),
      instagram: shortText(200).optional(),
      existingWebsite: shortText(500).optional(),
    })
    .optional(),

  website: z
    .object({
      selectedTemplate: shortText(64).optional(),
      preferredTheme: shortText(64).optional(),
    })
    .optional(),

  qualification: z
    .object({
      /** 0–1。模型對「這是不是一個真的需求」的把握 */
      confidence: z.number().min(0).max(1).optional(),
      recommendedService: shortText(64).optional(),
    })
    .optional(),
});

export type Lead = z.infer<typeof leadSchema>;

/**
 * 一筆 lead 至少要有一個聯絡方式才有意義。
 *
 * 沒有聯絡方式的 lead 是一段無法回覆的獨白——存下來只會讓收件匣看起來有東西。
 * 這個判斷放在程式裡而不是資料庫的 constraint：
 * 資料庫層面擋下來的話，模型收到的是一個看不懂的錯誤，
 * 它需要知道的是「還缺聯絡方式，去問」。
 */
export function hasContactChannel(lead: Lead): boolean {
  return Boolean(lead.contact?.email || lead.contact?.phone);
}

/** 還缺什麼。回傳給模型，讓它知道下一句該問什麼，而不是自己猜 */
export function missingLeadFields(lead: Lead): string[] {
  const missing: string[] = [];

  if (!hasContactChannel(lead)) missing.push("聯絡方式（信箱或電話，至少一個）");
  if (!lead.business?.name && !lead.business?.industry) missing.push("在做什麼（品牌名或產業）");
  if (!lead.requirement?.goal) missing.push("想達成什麼");

  return missing;
}
