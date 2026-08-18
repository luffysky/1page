import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { makeXlsx } from "../support/xlsx-writer";

import { createMember, deleteMember, sql } from "./helpers/member";

/**
 * 用 Excel／CSV 匯入（CR-003-5）
 *
 * ── 這一組驗的是「匯進來的東西是對的」 ───────────────────────
 *
 * 單元測試已經把解析、型別猜測、轉換各驗過一遍。這裡要驗的是
 * 那些在**瀏覽器裡**才成立的事：
 *
 *   1. 檔案真的讀得進去（不是我們自己餵字串給自己）
 *   2. 猜出來的型別看得到，而且改得動
 *   3. 匯進去的值真的存進資料庫，而且沒有變形
 *      ——電話開頭的 0 還在，斜線日期變成 ISO
 *   4. 匯不進去的那幾列，在按下送出**之前**就看得到
 *
 * 第 3 條是重點。前面每一層都綠、資料到了資料庫卻少一個 0，
 * 只有這一條抓得到。
 */

const EMAIL = "e2e-crm-import@1page.test";
const PASSWORD = "E2e!Import#2026";

let memberId: string | undefined;

test.beforeAll(async () => {
  memberId = await createMember(EMAIL, PASSWORD);
});

test.afterAll(async () => {
  await sql(`delete from crm_definitions where owner_id = '${memberId}'`).catch(() => {});
  if (memberId) await deleteMember(memberId);
});

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("密碼").fill(PASSWORD);
  await page.getByRole("button", { name: "登入" }).click();
  await page.waitForURL(new RegExp(next.split("?")[0]!), { timeout: 20_000 });
}

const CSV = [
  "名字,電話,金額,狀態,最後聯絡",
  "阿明,0912345678,1200,還在談,2026/8/18",
  "小華,0223456789,800,已成交,2026-07-01",
  "老王,0987654321,1500,還在談,2026/12/1",
].join("\n");

/** Excel 存 UTF-8 CSV 一定會加 BOM，所以 fixture 也要加 */
const csvFile = (name: string, text: string) => ({
  name,
  mimeType: "text/csv",
  buffer: Buffer.from("﻿" + text, "utf8"),
});

async function importInDesigner(page: Page, file: Parameters<typeof csvFile>[0] | object) {
  await page.getByLabel("選一個檔案（.xlsx、.csv）").setInputFiles(file as never);
}

test("⚠️ 從 CSV 建一類：猜出來的型別看得到，而且說得出理由", async ({ page }) => {
  await page.goto("/crm");
  await importInDesigner(page, csvFile("客戶名單.csv", CSV));

  await expect(page.getByText("讀到「客戶名單.csv」：5 欄、3 列。")).toBeVisible();

  // 檔名變成類別名字——使用者多半就是那個意思
  await expect(page.getByLabel("這一類要叫什麼")).toHaveValue("客戶名單");

  /*
   * ⚠️ 電話一定要是文字。
   *
   * 猜成數字的話 0912345678 會變成 912345678，而它看起來完全正常——
   * 這是整個匯入功能裡最難發現的一種錯。
   */
  await expect(page.getByLabel("「電話」要存成哪一種")).toHaveValue("text");
  await expect(page.getByLabel("「金額」要存成哪一種")).toHaveValue("number");
  await expect(page.getByLabel("「狀態」要存成哪一種")).toHaveValue("select");
  await expect(page.getByLabel("「最後聯絡」要存成哪一種")).toHaveValue("date");

  // 每一欄都要說得出為什麼——不然畫面上只是一排下拉選單擺在那裡
  await expect(page.getByText(/存成數字會掉開頭的 0/)).toBeVisible();
});

test("猜錯的型別改得掉，改完真的照新的型別建", async ({ page }) => {
  await page.goto("/crm");
  await importInDesigner(page, csvFile("客戶.csv", CSV));

  // 使用者不同意「金額是數字」，改成文字
  await page.getByLabel("「金額」要存成哪一種").selectOption("text");
  await page.getByRole("button", { name: "加進我的設計" }).click();

  /*
   * 加完之後游標跳到新的那一類。
   *
   * ⚠️ 名字是「客戶 2」不是「客戶」——預設的設計本來就有一類叫「客戶」，
   * 而匯入時的預設名字是檔名。不改名的話畫面上會有兩個一模一樣的按鈕。
   */
  await expect(page.getByRole("button", { name: "客戶 2", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "金額 單行文字" })).toBeVisible();
  await expect(page.getByRole("button", { name: "狀態 下拉選單" })).toBeVisible();
});

test("⚠️ 讀不了的檔案要明講，不能假裝匯成功", async ({ page }) => {
  /*
   * 舊的 .xls 是完全不同的格式。當純文字讀的話會得到一整片亂碼欄名，
   * 而使用者會以為是編碼問題，往完全錯的方向找。
   */
  await page.goto("/crm");
  await importInDesigner(page, {
    name: "舊檔.xls",
    mimeType: "application/vnd.ms-excel",
    // .xls 的檔頭
    buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]),
  });

  await expect(page.getByText(/舊版的 \.xls/)).toBeVisible();
  await expect(page.getByRole("button", { name: "加進我的設計" })).toHaveCount(0);
});

test("⚠️ 匯入的值存進資料庫之後沒有變形", async ({ page }) => {
  /*
   * 這一條是整組的重點：前面每一層都綠、資料到了資料庫卻少一個 0，
   * 只有走完一整圈才抓得到。
   */
  await signIn(page, "/crm");

  await importInDesigner(page, csvFile("匯入驗證.csv", CSV));
  await page.getByRole("button", { name: "加進我的設計" }).click();

  await page.getByLabel("這份 CRM 叫什麼").fill("匯入驗證");
  const saveAsNew = page.getByRole("button", { name: "另存新的一份" });
  await (
    (await saveAsNew.count()) > 0 ? saveAsNew : page.getByRole("button", { name: "存到我的帳號" })
  ).click();
  await expect(page.getByRole("status")).toContainText(/存好了|另存/, { timeout: 20_000 });

  const designs = await sql(
    `select id from crm_definitions where owner_id = '${memberId}' and name = '匯入驗證'`,
  );
  const designId = designs[0]?.id as string;
  expect(designId).toBeTruthy();

  /*
   * 記錄頁預設停在**第一類**，而第一類是預設設計裡的「客戶」——
   * 匯入的那一類排在後面。不切過去的話，對應的是另一組欄位。
   */
  await page.goto(`/account/crm/${designId}`);
  await page.getByRole("link", { name: "匯入驗證", exact: true }).click();
  /*
   * ⚠️ 等網址真的換過去再往下。
   *
   * 軟導覽的中間有一段時間，畫面上是**上一類**的匯入面板——
   * 這時候選檔案，對應會照上一類的欄位配（而那正是這個元件
   * 現在會擋掉的情況：換了類別就當作沒選過檔案）。
   * 少了這一行，測試會偶爾紅，而紅的原因與它要驗的事無關。
   */
  await expect(page).toHaveURL(/entity=/);
  await page.getByText(/用 Excel／CSV 匯入/).click();

  await page.getByLabel("選一個檔案（.xlsx、.csv）").setInputFiles(csvFile("匯入驗證.csv", CSV));

  // 欄名一樣，所以每一欄都自動配好了
  await expect(page.getByLabel("「電話」要放到哪一格")).toHaveValue(/.+/);
  await expect(page.getByText("3 列可以匯入")).toBeVisible();

  await page.getByRole("button", { name: "匯入這 3 筆" }).click();
  await expect(page.getByRole("status")).toContainText("匯入了 3 筆", { timeout: 20_000 });

  /*
   * ⚠️ 直接讀資料庫，不是讀畫面。
   *
   * 讀畫面的話，一個「顯示時補回開頭的 0」的 bug 會讓這條測試照樣綠。
   */
  // sql() 回的是 any，這裡明講形狀，不然 map 的參數推不出型別
  const rows = (await sql(
    `select data from crm_records where definition_id = '${designId}' order by created_at`,
  )) as { data: Record<string, unknown> }[];
  expect(rows).toHaveLength(3);

  const values = rows.map((row) => row.data);
  const phones = values.map((data) =>
    Object.values(data).find((value) => String(value).startsWith("09")),
  );
  expect(phones, "電話開頭的 0 不見了").toContain("0912345678");

  const dates = values.flatMap((data) => Object.values(data).map(String));
  expect(dates, "斜線日期沒有轉成 ISO").toContain("2026-08-18");
});

test("⚠️ 匯不進去的那幾列，按下送出之前就看得到", async ({ page }) => {
  /*
   * 送出之後才說的話，使用者已經匯進去一半，要在幾百筆裡一筆一筆找。
   */
  await signIn(page, "/crm");

  await importInDesigner(page, csvFile("有錯的.csv", CSV));
  // 把「最後聯絡」留成日期，等一下餵一份日期打錯的檔案進去
  await page.getByRole("button", { name: "加進我的設計" }).click();

  await page.getByLabel("這份 CRM 叫什麼").fill("壞資料");
  const saveAsNew = page.getByRole("button", { name: "另存新的一份" });
  await (
    (await saveAsNew.count()) > 0 ? saveAsNew : page.getByRole("button", { name: "存到我的帳號" })
  ).click();
  await expect(page.getByRole("status")).toContainText(/存好了|另存/, { timeout: 20_000 });

  const designs = await sql(
    `select id from crm_definitions where owner_id = '${memberId}' and name = '壞資料'`,
  );
  const designId = designs[0]?.id as string;

  await page.goto(`/account/crm/${designId}`);
  await page.getByRole("link", { name: "有錯的", exact: true }).click();
  await expect(page).toHaveURL(/entity=/);
  await page.getByText(/用 Excel／CSV 匯入/).click();

  const broken = [
    "名字,電話,金額,狀態,最後聯絡",
    "阿明,0912345678,1200,還在談,2026-08-18",
    "小華,0223456789,800,已成交,去年八月",
  ].join("\n");
  await page.getByLabel("選一個檔案（.xlsx、.csv）").setInputFiles(csvFile("壞的.csv", broken));

  await expect(page.getByText("1 列可以匯入")).toBeVisible();
  // 列號要對得上使用者在 Excel 裡看到的
  await expect(page.getByText(/第 3 列：「最後聯絡」/)).toBeVisible();
});

test("⚠️ 真的 .xlsx 也讀得進去", async ({ page }) => {
  /*
   * 單元測試用的是我們自己產的 xlsx，而它與讀檔那一端是同一個人寫的。
   * 這一條走的是瀏覽器真正的 DecompressionStream——
   * Node 有而瀏覽器沒有（或行為不同）的話，只有這裡會紅。
   */
  const file = await makeXlsx([
    ["名字", "金額", "最後聯絡"],
    ["阿明", "1200", "2026-08-18"],
    ["小華", "800", "2026-07-01"],
  ]);

  await page.goto("/crm");
  await importInDesigner(page, {
    name: "客戶.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(file),
  });

  await expect(page.getByText("讀到「客戶.xlsx」：3 欄、2 列。")).toBeVisible();
  await expect(page.getByLabel("「最後聯絡」要存成哪一種")).toHaveValue("date");
});

test("⚠️ 匯入面板打開的時候也過得了 axe", async ({ page }) => {
  /*
   * a11y-all-routes 掃的是頁面**預設**的樣子，而匯入面板收在
   * `<details>` 裡——預設關著，axe 根本看不到它。
   *
   * 面板裡全是 select 與 file input，而它們的名字都靠 aria-label 撐著：
   * 少一個就是一個「這是什麼下拉？」的欄位，而掃描不會發現。
   */
  await page.goto("/crm");
  await page.getByLabel("選一個檔案（.xlsx、.csv）").setInputFiles(csvFile("客戶名單.csv", CSV));
  await expect(page.getByText("讀到「客戶名單.csv」：5 欄、3 列。")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(
    results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`),
  ).toEqual([]);
});
