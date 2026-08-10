import type { PortfolioProjectType } from "./project-type";

/**
 * 作品詳細頁的資料模型（Spec §8.4 / §8.5）
 *
 * 只放 `/work/[slug]` 真的會渲染的欄位（Guardrail 2）。
 * Spec §8.4 的完整模型還有 status / sortOrder / createdAt 等，
 * 那些是 Admin（2E）與資料層的事，詳細頁不需要知道。
 */

/** Spec §8.5 */
export interface PortfolioMedia {
  id: string;
  type: "image" | "video" | "pdf" | "embed" | "external";
  url: string;
  thumbnailUrl?: string;
  /**
   * ⚠️ 必填。Spec §35。
   * 與 `PortfolioCard.cover` 同樣的型別設計：讓「有媒體但沒有替代文字」
   * 在編譯期就不可能成立。V3 Demo 的作品區全無替代文字（Spec §45.1）。
   */
  alt: string;
  caption?: string;
  role: "cover" | "gallery" | "mobile" | "desktop" | "before" | "after" | "document";
}

/**
 * Spec §8.10 的 Case Study 區塊。
 *
 * 全部選填是刻意的——Spec 明文要求：
 * 「如果沒有完整 Case Study 資料，只顯示存在的區塊。不要顯示空 Section。」
 */
export interface PortfolioCaseStudy {
  problem?: string;
  goal?: string;
  thinking?: string;
  solution?: string;
  result?: string;
}

export interface PortfolioLinks {
  live?: string;
  demo?: string;
  figma?: string;
  github?: string;
}

export interface PortfolioDetail {
  id: string;
  slug: string;
  title: string;
  kicker: string;
  summary?: string;

  projectType: PortfolioProjectType;
  categories: string[];
  tags: string[];
  /** 對應 config/services.ts 的 id（Spec §8.13） */
  services: string[];
  industry?: string;
  year?: number;

  caseStudy: PortfolioCaseStudy;
  media: PortfolioMedia[];
  links: PortfolioLinks;

  /** Spec §28：AI 揭露。未使用 AI 時不顯示此區塊 */
  aiDisclosure?: { used: boolean; description?: string };

  placeholderTone?: "cream" | "ink" | "accent";
}

/** Spec §8.10 的區塊順序，供詳細頁逐一渲染 */
export const CASE_STUDY_SECTIONS: { key: keyof PortfolioCaseStudy; label: string }[] = [
  { key: "problem", label: "Problem" },
  { key: "goal", label: "Goal" },
  { key: "thinking", label: "Thinking" },
  { key: "solution", label: "Solution" },
  { key: "result", label: "Result" },
];

/** 只回傳有內容的區塊——空 Section 不顯示（Spec §8.10） */
export function presentCaseStudySections(caseStudy: PortfolioCaseStudy) {
  return CASE_STUDY_SECTIONS.map((section) => ({
    ...section,
    body: caseStudy[section.key],
  })).filter((section): section is typeof section & { body: string } =>
    Boolean(section.body && section.body.trim()),
  );
}
