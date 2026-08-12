"use server";

import { createLead } from "@/features/leads/repository";
import { leadSchema } from "@/features/leads/schema";

/**
 * Project Builder 的送出（Spec §30）
 *
 * 用 Server Action 而非 API route：這是一次表單提交，
 * 不需要串流、不需要別的客戶端呼叫它。多開一條 `/api/*` 只會多一個
 * 要保護、要限流、要出現在稽核【9】裡的公開端點。
 *
 * ⚠️ 與 Agent 走**同一個** createLead。兩條路徑各寫一次 insert 的話，
 * 之後加欄位會漏掉其中一邊，而漏掉的那邊不會報錯，
 * 只是收件匣裡有些 lead 少了資料。
 */

export type BuilderResult = { ok: true } | { ok: false; message: string };

export async function submitProject(formData: FormData): Promise<BuilderResult> {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };

  const checked = (key: string) => formData.get(key) === "on";

  const parsed = leadSchema.safeParse({
    contact: {
      name: text("contactName"),
      email: text("contactEmail"),
      phone: text("contactPhone"),
    },
    business: {
      name: text("businessName"),
      industry: text("businessIndustry"),
      description: text("description"),
    },
    requirement: {
      service: formData
        .getAll("service")
        .filter((item): item is string => typeof item === "string"),
      goal: text("goal"),
      deadline: text("deadline"),
      budgetRange: text("budget"),
    },
    assets: {
      logo: checked("assetLogo"),
      photos: checked("assetPhotos"),
      copy: checked("assetCopy"),
      instagram: text("instagram"),
      existingWebsite: text("existingWebsite"),
    },
    website: {
      selectedTemplate: text("selectedTemplate"),
      preferredTheme: text("preferredTheme"),
    },
  });

  if (!parsed.success) {
    // 把第一個問題講出來。列出全部只會讓人不知道要先修哪個。
    return { ok: false, message: parsed.error.issues[0]?.message ?? "有欄位填得不對" };
  }

  if (!parsed.data.contact?.email && !parsed.data.contact?.phone) {
    // 沒有聯絡方式的需求是一段無法回覆的獨白。這一條在 schema 之外，
    // 因為它不是格式問題——每個欄位都合法，但這份東西沒有用。
    return { ok: false, message: "請至少留一個聯絡方式：信箱或電話。" };
  }

  const record = await createLead(parsed.data);

  if (!record) {
    // 假裝成功是最糟的：他以為留好了，而我們永遠不會聯絡他。
    return { ok: false, message: "這次沒有送出成功。請直接寫信給我們，或稍後再試一次。" };
  }

  return { ok: true };
}
