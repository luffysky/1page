// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { implementedSectionTypes, resolveSection } from "./registry";
import { IMAGE_CONTENT_KEY, siteSectionSchema } from "./schema";
import { newSection } from "./section-presets";

/**
 * 圖片欄位（CR-003-4）
 *
 * ── 這裡守的是「會畫圖，但編輯器裡沒有地方放圖」 ────────────────
 *
 * 編輯器的內容面板是照著**值目前的形狀**產生欄位的。也就是說，
 * 一個區塊要能上傳圖片，它的預設內容裡就得先有 `images` 這個鍵——
 * 沒有的話，那個上傳欄位永遠不會出現。
 *
 * 而元件那邊完全不需要這個鍵也能跑（沒有圖就畫色塊），所以少了它
 * **不會報錯、不會紅、build 照過**：只是使用者永遠找不到上傳的地方。
 *
 * 又是同一種毛病，所以這裡照樣反過來問：
 * **有沒有哪個會畫圖的區塊，預設內容裡沒有那個鍵**。
 *
 * 判斷「會不會畫圖」不靠一份人工清單，而是實際塞一張圖進去看畫面變不變。
 * 新增一種會畫圖的區塊時，它自己會被抓進來。
 */

const MEDIA_HOST = "media.example.test";
const SAMPLE = `https://${MEDIA_HOST}/sites/a/b.jpg`;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_DOMAIN_URL", MEDIA_HOST);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** 塞一張圖進去，畫面有沒有變 */
function readsImages(type: ReturnType<typeof implementedSectionTypes>[number]) {
  const base = newSection(type, []);
  const resolved = resolveSection(base);
  if (!resolved) return false;

  const Component = resolved.component;

  const without = render(<Component section={base} />);
  const before = without.container.innerHTML;
  without.unmount();

  const withImage = render(
    <Component
      section={{ ...base, content: { ...base.content, [IMAGE_CONTENT_KEY]: [SAMPLE] } }}
    />,
  );
  const after = withImage.container.innerHTML;
  withImage.unmount();

  return before !== after;
}

describe("圖片欄位", () => {
  it("會畫圖的區塊，預設內容裡就有 images 這個鍵", () => {
    const missing = implementedSectionTypes().filter(
      (type) => readsImages(type) && newSection(type, []).content[IMAGE_CONTENT_KEY] === undefined,
    );

    expect(missing, `這些區塊畫得出圖，但編輯器裡不會出現上傳欄位：${missing.join("、")}`).toEqual(
      [],
    );
  });

  it("預設的空 images 通得過 schema", () => {
    // 空陣列被擋下來的話，每一個 gallery 區塊從加出來的那一刻就是無效的
    for (const type of implementedSectionTypes()) {
      const section = newSection(type, []);
      if (section.content[IMAGE_CONTENT_KEY] === undefined) continue;

      expect(siteSectionSchema.safeParse(section).success, `${type} 的預設內容不合法`).toBe(true);
    }
  });

  it("外部網域的圖片進不來", () => {
    /*
     * 這一條釘的是「圖片欄位有沒有真的走來源檢查」。
     * 只驗 gallery 的話，之後多一種會畫圖的區塊時它驗不到——
     * 所以對每一個有 images 的型別都試一次。
     */
    for (const type of implementedSectionTypes()) {
      const section = newSection(type, []);
      if (section.content[IMAGE_CONTENT_KEY] === undefined) continue;

      const attacked = {
        ...section,
        content: { ...section.content, [IMAGE_CONTENT_KEY]: ["https://evil.example.com/x.jpg"] },
      };

      expect(siteSectionSchema.safeParse(attacked).success, `${type} 收了外部網域的圖`).toBe(false);
    }
  });
});
