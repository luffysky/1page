"use client";

import { useId } from "react";

import { ImageUploadField } from "@/components/editor/image-upload-field";
import { useSitePreview } from "@/features/website-engine/preview-context";
import { variantsFor } from "@/features/website-engine/registry";
import {
  IMAGE_CONTENT_KEY,
  MAX_CONTENT_ITEMS,
  type SiteSection,
} from "@/features/website-engine/schema";
import { SECTION_LABELS } from "@/features/website-engine/section-presets";

/**
 * 選取區塊的內容編輯（CR-003-4 第三段）
 *
 * ── 為什麼是「照著值長什麼樣子」決定欄位，而不是每種區塊寫一份表單 ──
 *
 * content 的型別是 `Record<string, ContentValue>`（3A 的 schema），
 * 值可以是字串、數字、布林、字串陣列，或 `{label, href?, text?}` 陣列。
 * 每種 section 用到哪些鍵，是各元件自己決定的。
 *
 * 為每一種 section 手寫一份表單的話，就是**第二份 schema**——
 * 而它與元件實際讀的欄位遲早分歧。分歧的表現是
 * 「編輯器裡改了某個欄位，畫面沒有反應」，因為那個欄位根本沒人讀。
 *
 * 所以這裡照著**值目前的形狀**產生欄位。新增一種 section 或多一個欄位，
 * 這個面板自動就有得改，不需要回來補。
 *
 * 代價：欄位名稱是英文的鍵名（title / subtitle / items）。
 * 那不理想，但比「有一個改了沒反應的欄位」好——後者會讓人以為功能壞了。
 * 常見的幾個給了中文名，其餘照原樣顯示。
 */

const FIELD_LABELS: Record<string, string> = {
  title: "標題",
  subtitle: "副標",
  eyebrow: "小標",
  body: "內文",
  text: "文字",
  captions: "圖說",
  items: "項目",
  actions: "按鈕",
  submitLabel: "送出按鈕文字",
  query: "地址或地標",
  videoId: "YouTube 影片 id",
};

const fieldLabel = (key: string) => FIELD_LABELS[key] ?? key;

/** 陣列裡的物件項目。schema 保證有 label，text 與 href 可能沒有 */
type ItemValue = { label: string; href?: string; text?: string };

const isItemArray = (value: unknown): value is ItemValue[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  typeof value[0] === "object" &&
  value[0] !== null &&
  "label" in (value[0] as object);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * 刪到剩一項就不能再刪了。
 *
 * ⚠️ 這不是為了「至少留一點內容」，是因為欄位的形狀是**從現在的值認出來的**
 * （見上面那段說明）。空陣列既是空的字串陣列也是空的項目陣列，
 * 認不出來——刪光「服務」的三個項目之後，這個面板會把它當成字串清單，
 * 於是「新增一項」加出來的東西是錯的形狀，畫面上那一塊直接不見。
 *
 * 要真的清空的話，該做的是移除整個區塊，那顆按鈕在工具列上。
 */
const MIN_ITEMS = 1;

/** 陣列欄位共用的加／減按鈕 */
function ListControls({
  label,
  count,
  onAdd,
}: {
  label: string;
  count: number;
  onAdd: () => void;
}) {
  const full = count >= MAX_CONTENT_ITEMS;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onAdd}
        disabled={full}
        className="border-brand-line text-body-sm rounded-pill border px-4 py-2 font-bold disabled:opacity-50"
      >
        新增一個{label}
      </button>

      {/*
       * 上限到了就說出來。
       *
       * 不說的話，schema 會拒絕、狀態不變、畫面沒有任何反應——
       * 使用者只會覺得這顆按鈕壞了。
       */}
      {full ? (
        <span className="text-caption text-brand-muted">
          最多 {MAX_CONTENT_ITEMS} 項，已經滿了。
        </span>
      ) : null}
    </div>
  );
}

function RemoveItemButton({
  label,
  index,
  count,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  onRemove: () => void;
}) {
  const last = count <= MIN_ITEMS;

  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={last}
      /*
       * 「刪除」，不是「移除」。
       *
       * 區塊工具列那顆叫「移除」，指的是整塊拿掉。兩顆按鈕都寫「移除」的話，
       * 使用者按下去之前分不出會少一項還是少一整塊——而那兩件事的
       * 後果差很多。動詞分開比任何提示文字都有效。
       */
      aria-label={`刪除第 ${index + 1} 項${label}`}
      title={last ? "只剩一項了。要整塊拿掉請用區塊工具列的「移除」" : undefined}
      className="border-brand-line text-caption rounded-pill border px-3 py-1 font-bold disabled:opacity-50"
    >
      刪除
    </button>
  );
}

export function ContentPanel({ section, signedIn }: { section: SiteSection; signedIn: boolean }) {
  const { updateContent, setVariant } = useSitePreview();
  const panelId = useId();

  const variants = variantsFor(section.type);
  const entries = Object.entries(section.content);

  const patch = (key: string, value: SiteSection["content"][string]) =>
    updateContent(section.id, { [key]: value });

  return (
    <div className="border-brand-line rounded-lg border p-4">
      <h2 className="text-body font-bold">
        編輯「{SECTION_LABELS[section.type] ?? section.type}」
      </h2>

      {/*
       * 變體切換。只列這個 type 真的有的排版——
       * setSectionVariant 會拒絕不存在的，而使用者只會看到「按了沒反應」。
       * 只有一種排版時整組不顯示，一顆按不了的按鈕沒有意義。
       */}
      {variants.length > 1 ? (
        <fieldset className="mt-4">
          <legend className="text-body-sm font-bold">排版</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant}
                type="button"
                onClick={() => setVariant(section.id, variant)}
                aria-pressed={section.variant === variant}
                className={`text-body-sm rounded-pill border px-4 py-2 font-bold ${
                  section.variant === variant
                    ? "bg-brand-ink text-brand-on-ink border-brand-ink"
                    : "border-brand-line"
                }`}
              >
                {variant}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="mt-5 flex flex-col gap-4">
        {entries.length === 0 ? (
          <p className="text-body-sm text-brand-muted">這一塊沒有可以編輯的文字。</p>
        ) : null}

        {entries.map(([key, value]) => {
          const id = `${panelId}-${key}`;

          if (key === IMAGE_CONTENT_KEY) {
            return (
              <ImageUploadField
                key={key}
                images={isStringArray(value) ? value : []}
                signedIn={signedIn}
                onChange={(next) => patch(key, next)}
              />
            );
          }

          if (typeof value === "string") {
            const long = value.length > 60;

            return (
              <div key={key}>
                <label htmlFor={id} className="text-body-sm block font-bold">
                  {fieldLabel(key)}
                </label>
                {long ? (
                  <textarea
                    id={id}
                    rows={3}
                    value={value}
                    onChange={(event) => patch(key, event.target.value)}
                    className="border-brand-line bg-brand-paper text-body-sm mt-2 w-full rounded-md border px-3 py-2"
                  />
                ) : (
                  <input
                    id={id}
                    type="text"
                    value={value}
                    onChange={(event) => patch(key, event.target.value)}
                    className="border-brand-line bg-brand-paper text-body-sm mt-2 w-full rounded-md border px-3 py-2"
                  />
                )}
              </div>
            );
          }

          if (isStringArray(value)) {
            return (
              <fieldset key={key}>
                <legend className="text-body-sm font-bold">{fieldLabel(key)}</legend>
                <div className="mt-2 flex flex-col gap-2">
                  {value.map((item, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <label htmlFor={`${id}-${index}`} className="sr-only">
                        {fieldLabel(key)}第 {index + 1} 項
                      </label>
                      <input
                        id={`${id}-${index}`}
                        type="text"
                        value={item}
                        onChange={(event) => {
                          const next = [...value];
                          next[index] = event.target.value;
                          patch(key, next);
                        }}
                        className="border-brand-line bg-brand-paper text-body-sm min-w-[10rem] flex-1 rounded-md border px-3 py-2"
                      />
                      <RemoveItemButton
                        label={fieldLabel(key)}
                        index={index}
                        count={value.length}
                        onRemove={() =>
                          patch(
                            key,
                            value.filter((_, at) => at !== index),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>

                <ListControls
                  label={fieldLabel(key)}
                  count={value.length}
                  // 加一個空字串，不是「新項目」之類的預設文字：
                  // 那種字會被原封不動地留在畫面上，而使用者以為自己已經改過了
                  onAdd={() => patch(key, [...value, ""])}
                />
              </fieldset>
            );
          }

          if (isItemArray(value)) {
            return (
              <fieldset key={key}>
                <legend className="text-body-sm font-bold">{fieldLabel(key)}</legend>

                <div className="mt-2 flex flex-col gap-3">
                  {value.map((item, index) => (
                    <div key={index} className="border-brand-line rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-caption text-brand-muted">第 {index + 1} 項</span>
                        <RemoveItemButton
                          label={fieldLabel(key)}
                          index={index}
                          count={value.length}
                          onRemove={() =>
                            patch(
                              key,
                              value.filter((_, at) => at !== index),
                            )
                          }
                        />
                      </div>

                      <label htmlFor={`${id}-${index}-label`} className="text-caption mt-2 block">
                        標題
                      </label>
                      <input
                        id={`${id}-${index}-label`}
                        type="text"
                        value={item.label}
                        onChange={(event) => {
                          const next = [...value];
                          next[index] = { ...item, label: event.target.value };
                          patch(key, next);
                        }}
                        className="border-brand-line bg-brand-paper text-body-sm mt-1 w-full rounded-md border px-3 py-2"
                      />

                      {/*
                       * text 可能原本就沒有（例如 hero 的 actions 只有 label）。
                       * 那時仍然給一個空欄位讓人可以加上去，而不是把欄位藏起來——
                       * 藏起來的話使用者沒有任何辦法補上說明文字。
                       */}
                      <label htmlFor={`${id}-${index}-text`} className="text-caption mt-2 block">
                        說明
                      </label>
                      <input
                        id={`${id}-${index}-text`}
                        type="text"
                        value={item.text ?? ""}
                        onChange={(event) => {
                          const next = [...value];
                          const text = event.target.value;
                          next[index] = text ? { ...item, text } : { ...item, text: "" };
                          patch(key, next);
                        }}
                        className="border-brand-line bg-brand-paper text-body-sm mt-1 w-full rounded-md border px-3 py-2"
                      />
                    </div>
                  ))}
                </div>

                {/*
                 * 新的一項只給 label，不給 text。
                 *
                 * 給了空的 text 之後，沒有填的那些區塊會多渲染一行空白；
                 * 需要說明文字的話下面那個欄位本來就在，打了字才會存進去。
                 */}
                <ListControls
                  label={fieldLabel(key)}
                  count={value.length}
                  onAdd={() => patch(key, [...value, { label: "" }])}
                />
              </fieldset>
            );
          }

          // 數字與布林：目前的模板沒有用到，但 schema 允許。
          // 顯示成唯讀而不是靜靜跳過——跳過的話那個欄位就永遠改不到。
          return (
            <div key={key}>
              <span className="text-body-sm block font-bold">{fieldLabel(key)}</span>
              <p className="text-caption text-brand-muted mt-1">
                這個欄位（{typeof value}）目前還不能在這裡編輯。
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
