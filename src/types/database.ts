/**
 * 由資料庫 schema 自動產生 —— 請勿手動編輯。
 *
 * 重新產生：pnpm db:types
 * 產生器：scripts/db-types.mjs（透過 pg-meta introspect information_schema）
 *
 * 目前只含 Row 型別與 enum。Insert / Update 於 2E 需要寫入時再加。
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type PortfolioMediaRole =
  "cover" | "gallery" | "mobile" | "desktop" | "before" | "after" | "document";
export type PortfolioMediaType = "image" | "video" | "pdf" | "embed" | "external";
export type PortfolioProjectType = "client" | "concept" | "demo" | "internal";
export type PortfolioStatus = "draft" | "published" | "archived";

export interface AdminUsersRow {
  user_id: string;
  note: string | null;
  created_at: string;
}

export interface PortfolioCategoriesRow {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface PortfolioMediaRow {
  id: string;
  project_id: string;
  type: PortfolioMediaType;
  url: string;
  thumbnail_url: string | null;
  alt: string | null;
  caption: string | null;
  role: PortfolioMediaRole;
  sort_order: number;
  created_at: string;
}

export interface PortfolioProjectCategoriesRow {
  project_id: string;
  category_id: string;
}

export interface PortfolioProjectTagsRow {
  project_id: string;
  tag_id: string;
}

export interface PortfolioProjectsRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  project_type: PortfolioProjectType;
  status: PortfolioStatus;
  industry: string | null;
  year: number | null;
  featured: boolean;
  sort_order: number;
  case_study_json: Json;
  links_json: Json;
  ai_disclosure_json: Json;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  kicker: string | null;
  services: string[];
}

export interface PortfolioTagsRow {
  id: string;
  slug: string;
  name: string;
}
