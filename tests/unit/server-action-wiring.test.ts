import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 每一個 Server Action 都要有人叫、而且都要驗身分（0818 收尾稽核）
 *
 * ── 為什麼要有這一份 ──────────────────────────────────────────
 *
 * 收尾清查時翻出 `adminListUrl`：一個從 2E 就存在、**沒有任何呼叫點、
 * 也沒有驗身分**的 Server Action，而它回傳的是後台的密路徑。
 *
 * Server Action 不是「那個頁面才叫得到的函式」，它是一個**公開端點**。
 * 沒有呼叫點不代表它不存在——只代表沒有人記得它還在。
 *
 * 這是【8】路由可達性、【9】API 接線、§31 事件呼叫點的第四個版本：
 * 宣告了一個東西，卻沒有任何地方用到它。
 *
 * ── 問法是反過來的 ────────────────────────────────────────────
 *
 * 不列「哪些 action 要驗身分」，而是問「**清單裡有沒有哪一個沒驗**」。
 * 前者每次新增都要記得補，後者會自己發現下一個。
 */

const ROOT = process.cwd();
const SOURCE = join(ROOT, "src");

function collect(dir: string): { path: string; content: string }[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collect(full);
    if (![".ts", ".tsx"].includes(extname(full))) return [];
    return [
      { path: relative(ROOT, full).split("\\").join("/"), content: readFileSync(full, "utf8") },
    ];
  });
}

const files = collect(SOURCE);

/** 註解裡提到某個名字不算「有人叫它」。稽核腳本踩過這個，一次假通過一次假失敗 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * 一個檔案裡出現過的所有識別字。
 *
 * ⚠️ 用切詞而不是 `includes(name)`：後者會讓 `signOut` 被
 * `signOutAction` 的每一次出現當成「有人叫它」——一個永遠不會紅的守衛。
 */
function identifiers(source: string): Set<string> {
  return new Set(stripComments(source).split(/[^A-Za-z0-9_]+/));
}

interface Action {
  name: string;
  file: string;
  body: string;
}

const actionFiles = files.filter((file) => /^\s*"use server";/m.test(file.content));

const actions: Action[] = actionFiles.flatMap((file) => {
  const code = stripComments(file.content);
  const found: Action[] = [];

  // 逐個抓 `export async function X(` 到下一個頂層 `}` 為止
  const pattern = /export async function ([A-Za-z0-9_]+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const start = match.index;
    const end = code.indexOf("\n}", start);
    found.push({
      name: match[1]!,
      file: file.path,
      body: code.slice(start, end === -1 ? code.length : end),
    });
  }

  return found;
});

/**
 * 不必驗身分的，要寫在這裡並附理由。
 *
 * ⚠️ 「它只是讀資料」不是理由。理由必須說明**為什麼公開呼叫是安全的**。
 */
const NO_AUTH_BY_DESIGN: Record<string, string> = {
  submitProject: "Project Builder 的表單本來就給未登入的訪客用（Spec §8.11 的 Lead）",
  signOut: "登出。沒有 session 的人呼叫它不會發生任何事",
  signOutAction: "登出（後台版）。沒有 session 的人呼叫它不會發生任何事",
  removeSavedSite:
    "刪除條件全靠 RLS（owner_id = auth.uid()）；未登入時 auth.uid() 是 null，刪不到任何一列",
  removeCrmDesignAction: "同上，crm_definitions 的 delete policy 就是 owner_id = auth.uid()",
  removeCrmRecordAction: "同上，crm_records 經由 definition 的擁有權判斷",
};

/** 算得上「驗過身分」的呼叫。RLS 那幾條走上面的具名例外，不在這裡放行 */
const AUTH_CALLS = /requireStaff|getAdminIdentity|getMemberIdentity|requireMember|requireAdmin/;

describe("Server Action 的接線", () => {
  it("找得到 action（守衛本身沒有因為抓不到東西而空轉）", () => {
    /*
     * ⚠️ 少了這一條，正則寫壞時 actions 會是空陣列，
     * 下面每一條都「通過」——一份掃不到東西的稽核永遠是綠的。
     */
    expect(actionFiles.length).toBeGreaterThan(5);
    expect(actions.length).toBeGreaterThan(30);
  });

  it("⚠️ 每一個 action 都有呼叫點", () => {
    const orphans = actions.filter((action) => {
      const callers = files.filter(
        (file) => file.path !== action.file && identifiers(file.content).has(action.name),
      );
      return callers.length === 0;
    });

    expect(
      orphans.map((action) => `${action.name}（${action.file}）`),
      "這些 Server Action 沒有任何呼叫點。它們仍然是公開端點——沒人叫不代表叫不到",
    ).toEqual([]);
  });

  it("⚠️ 每一個 action 都驗身分，或列在具名例外清單裡", () => {
    const unguarded = actions.filter(
      (action) => !AUTH_CALLS.test(action.body) && !(action.name in NO_AUTH_BY_DESIGN),
    );

    expect(
      unguarded.map((action) => `${action.name}（${action.file}）`),
      "這些 Server Action 沒有驗身分。要嘛補上，要嘛寫進 NO_AUTH_BY_DESIGN 並說明為什麼公開呼叫是安全的",
    ).toEqual([]);
  });

  it("例外清單不會留下已經不存在的名字", () => {
    // 留著的話，下一次有人加了一個同名 action，它會自動被放行
    const names = new Set(actions.map((action) => action.name));
    const stale = Object.keys(NO_AUTH_BY_DESIGN).filter((name) => !names.has(name));
    expect(stale, "NO_AUTH_BY_DESIGN 裡有已經不存在的 action").toEqual([]);
  });

  it("每一條例外都寫得出理由", () => {
    for (const [name, reason] of Object.entries(NO_AUTH_BY_DESIGN)) {
      expect(reason.length, `${name} 的理由太短，說不出為什麼公開呼叫是安全的`).toBeGreaterThan(10);
    }
  });
});
