"use client";

import { useCallback, useEffect, useId, useReducer, useState } from "react";

import { CrmPreview } from "@/components/crm/crm-preview";
import { ImportDesign } from "@/components/crm/import-design";
import { FieldRow } from "@/components/crm/field-row";
import { CrmSaveBar } from "@/components/crm/crm-save-bar";
import {
  addEntity,
  addField,
  type CrmOpResult,
  dropFieldOn,
  moveField,
  removeEntity,
  removeField,
  renameDefinition,
  renameEntity,
  startingDefinition,
  updateField,
} from "@/features/crm-builder/ops";
import {
  CRM_FIELD_TYPE_LABELS,
  CRM_FIELD_TYPES,
  CRM_LIMITS,
  type CrmDefinition,
  type CrmField,
} from "@/features/crm-builder/schema";
import { readCrmDraft, writeCrmDraft } from "@/features/crm-builder/storage";

/**
 * CRM 設計器（CR-003-5 / Spec §47）
 *
 * ── 這不是重寫一個編輯器，是換一組 widget ────────────────────
 *
 * 搬動的規則（`lib/reorder` 的 `moveInOrder`）與網站編輯器是**同一份**，
 * 所以拖曳、鍵盤、觸控三條路徑在結構上不可能有不同的行為。
 * 每一個操作都是 `crm-builder/ops` 的純函式，失敗時回原本那份定義，
 * 畫面上的表現是「沒事發生」，而不是一份改到一半的設計。
 *
 * ── 定價與網站編輯器一致 ──────────────────────────────────────
 *
 * 設計免費、不用登入（狀態在 sessionStorage）；存下來才要帳號。
 *
 * ── 界線寫在畫面上，不是只寫在註解裡 ─────────────────────────
 *
 * 這裡設計的是**一份表單的結構**，不是一套會自己跑流程的系統。
 * 沒有自動化、沒有寄信、沒有欄位之間的關聯。
 * 做一個看起來什麼都能設定、實際上只有六種欄位的畫布，
 * 比誠實說明更糟——前者要等使用者設計了半天才發現。
 */

interface State {
  definition: CrmDefinition;
  /*
   * 目前在編哪一類。
   *
   * ⚠️ 放在 reducer 裡而不是另一個 useState，是因為它**必須跟著定義一起變**：
   * 刪掉正在編的那一類、還原上一次的設計、復原到一個還沒有這一類的狀態——
   * 三件事都會讓它指向一個不存在的 id。
   *
   * 分成兩個 state 的話就得在 effect 裡把它同步回來，而那是
   * 「在 effect 裡 setState」——會多一次 render，也會有一幀畫面
   * 指著已經不存在的東西。
   */
  entityId: string;
  savedId: string | null;
  past: CrmDefinition[];
  future: CrmDefinition[];
  /** 上一次操作被純函式擋下來的理由。成功時清掉 */
  error: string | null;
}

type Action =
  | { type: "apply"; result: CrmOpResult }
  | { type: "select-entity"; id: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "restore"; definition: CrmDefinition; savedId: string | null }
  | { type: "saved"; id: string };

const MAX_HISTORY = 40;

/**
 * 定義換掉之後，游標該停在哪一類。
 *
 * 三條規則，順序有意義：
 *   1. 新出現了一類 → 跳過去（剛按下「新增一類」的人要的是那一類）
 *   2. 原本那一類還在 → 不動
 *   3. 都不是 → 退回第一類（原本那一類被刪掉了，或復原到它還不存在的時候）
 *
 * 少了第 3 條，刪掉正在編的類別之後畫面會指向一個不存在的 id，
 * 而那個表現是整個右半邊變成空白。
 */
function entityAfter(previous: CrmDefinition, next: CrmDefinition, current: string): string {
  const before = new Set(previous.entities.map((entity) => entity.id));
  const added = next.entities.find((entity) => !before.has(entity.id));
  if (added) return added.id;

  return next.entities.some((entity) => entity.id === current) ? current : next.entities[0]!.id;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "apply": {
      if (!action.result.ok) return { ...state, error: action.result.error };

      // 沒有真的改變就不進歷史。進的話「按了一下沒動的上移」也要按一次復原
      if (action.result.definition === state.definition) return { ...state, error: null };

      return {
        ...state,
        definition: action.result.definition,
        entityId: entityAfter(state.definition, action.result.definition, state.entityId),
        past: [...state.past, state.definition].slice(-MAX_HISTORY),
        future: [],
        error: null,
      };
    }

    case "select-entity":
      return { ...state, entityId: action.id };

    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;

      return {
        ...state,
        definition: previous,
        entityId: entityAfter(state.definition, previous, state.entityId),
        past: state.past.slice(0, -1),
        future: [state.definition, ...state.future].slice(0, MAX_HISTORY),
        error: null,
      };
    }

    case "redo": {
      const next = state.future[0];
      if (!next) return state;

      return {
        ...state,
        definition: next,
        entityId: entityAfter(state.definition, next, state.entityId),
        past: [...state.past, state.definition].slice(-MAX_HISTORY),
        future: state.future.slice(1),
        error: null,
      };
    }

    case "restore":
      return {
        definition: action.definition,
        entityId: action.definition.entities[0]!.id,
        savedId: action.savedId,
        past: [],
        future: [],
        error: null,
      };

    case "saved":
      /*
       * ⚠️ 一樣就回原本那個物件，不是一份新的複本。
       *
       * useReducer 在 reducer 回傳同一個參照時會直接跳過重繪。
       * 回複本的話，SaveBar 那個「存好之後把 id 記回來」的 effect
       * 會再跑一次 → 再 dispatch → 再重繪，無限下去。
       * （實際發生過：e2e 的瀏覽器 console 噴 Maximum update depth exceeded。）
       */
      if (state.savedId === action.id) return state;
      return { ...state, savedId: action.id };
  }
}

export function CrmDesigner({
  signedIn,
  initialDefinition,
  initialSavedId,
}: {
  signedIn: boolean;
  initialDefinition?: CrmDefinition;
  initialSavedId?: string;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const definition = initialDefinition ?? startingDefinition();
    return {
      definition,
      entityId: definition.entities[0]!.id,
      savedId: initialSavedId ?? null,
      past: [],
      future: [],
      error: null,
    };
  });

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const nameId = useId();

  /*
   * 還原上一次設計到一半的東西。
   *
   * 在 effect 裡做而不是放進 useReducer 的初始值：初始值在伺服器端
   * 也會跑一次，而 sessionStorage 只有瀏覽器有——放進去會 hydration
   * mismatch。代價是回訪時會先看到一幀預設內容（與網站編輯器同一個取捨）。
   *
   * ⚠️ 帶著 `?id=` 進來（從「我的 CRM」點編輯）時**不還原**：
   * 那時使用者要的是資料庫裡那一份，不是瀏覽器裡的殘留。
   */
  useEffect(() => {
    if (initialDefinition) return;

    const stored = readCrmDraft();
    if (stored) {
      dispatch({ type: "restore", definition: stored.definition, savedId: stored.savedId });
    }
  }, [initialDefinition]);

  useEffect(() => {
    writeCrmDraft({ definition: state.definition, savedId: state.savedId });
  }, [state.definition, state.savedId]);

  const definition = state.definition;
  const entity =
    definition.entities.find((item) => item.id === state.entityId) ?? definition.entities[0]!;
  const selectedField: CrmField | null =
    entity.fields.find((field) => field.id === selectedFieldId) ?? null;

  const apply = (result: CrmOpResult) => dispatch({ type: "apply", result });

  /*
   * ⚠️ 一定要 useCallback。
   *
   * SaveBar 把它放在 effect 的相依陣列裡，而 inline 的箭頭函式
   * **每一次 render 都是新的身分**——於是那個 effect 每次都跑，
   * 每次都 dispatch，每次都再 render 一次。
   *
   * 網站編輯器那邊沒踩到，是因為它的 setSavedSite 來自 useMemo 過的
   * context value；這裡沒有 context，就得自己來。
   */
  const handleSaved = useCallback((id: string) => dispatch({ type: "saved", id }), []);

  return (
    <div className="mx-auto w-full max-w-page px-gutter pb-20 lg:px-gutter-lg">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        {/* ---------------------------------------------------------------- */}
        {/* 設計面板                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="crm-design-heading">
          <h2 id="crm-design-heading" className="text-heading-1">
            設計
          </h2>

          <label htmlFor={nameId} className="text-body-sm mt-6 block font-bold">
            這份 CRM 叫什麼
          </label>
          <input
            id={nameId}
            value={definition.name}
            onChange={(event) => apply(renameDefinition(definition, event.target.value))}
            maxLength={80}
            className="border-brand-line bg-brand-paper text-body mt-2 w-full rounded-md border px-4 py-3"
          />

          {/* 類別 */}
          <div className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-body-sm font-bold">分成幾類</h3>
              <span className="text-caption text-brand-muted">
                {definition.entities.length} / {CRM_LIMITS.entities}
              </span>
            </div>

            <ul className="mt-3 flex flex-wrap gap-2">
              {definition.entities.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: "select-entity", id: item.id });
                      setSelectedFieldId(null);
                    }}
                    aria-current={item.id === entity.id ? "true" : undefined}
                    className={`text-body-sm rounded-pill border px-4 py-2 ${
                      item.id === entity.id
                        ? "border-brand-ink bg-brand-ink text-brand-on-ink font-bold"
                        : "border-brand-line"
                    }`}
                  >
                    {item.name}
                  </button>
                </li>
              ))}

              <li>
                <button
                  type="button"
                  onClick={() => {
                    // 加完自動切過去，那條規則寫在 reducer 的 entityAfter 裡——
                    // 元件不必再算一次「剛剛加的是哪一個」
                    apply(addEntity(definition, "新類別"));
                    setSelectedFieldId(null);
                  }}
                  className="border-brand-line text-body-sm rounded-pill border border-dashed px-4 py-2"
                >
                  ＋ 新增一類
                </button>
              </li>
            </ul>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1">
                <span className="text-caption text-brand-muted block">這一類的名字</span>
                <input
                  value={entity.name}
                  onChange={(event) =>
                    apply(renameEntity(definition, entity.id, event.target.value))
                  }
                  maxLength={60}
                  className="border-brand-line bg-brand-paper text-body-sm mt-1 w-full rounded-md border px-3 py-2"
                />
              </label>
              <button
                type="button"
                // 刪掉之後停在哪一類同樣由 entityAfter 決定
                onClick={() => apply(removeEntity(definition, entity.id))}
                className="text-caption text-brand-muted py-2 underline underline-offset-4"
              >
                刪掉這一類
              </button>
            </div>
          </div>

          {/* 欄位 */}
          <div className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-body-sm font-bold">「{entity.name}」要記哪些東西</h3>
              <span className="text-caption text-brand-muted">
                {entity.fields.length} / {CRM_LIMITS.fieldsPerEntity}
              </span>
            </div>

            <p className="text-caption text-brand-muted mt-2">
              拖曳可以排順序，也可以用每一列的 ↑ ↓ ——兩種做的是同一件事。
            </p>

            <ul className="mt-3 flex flex-col gap-2">
              {entity.fields.map((field, index) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  index={index}
                  total={entity.fields.length}
                  selected={field.id === selectedFieldId}
                  dragging={dragId === field.id}
                  onSelect={() =>
                    setSelectedFieldId((current) => (current === field.id ? null : field.id))
                  }
                  onMove={(direction) =>
                    apply(moveField(definition, entity.id, field.id, direction))
                  }
                  onRemove={() => {
                    apply(removeField(definition, entity.id, field.id));
                    setSelectedFieldId(null);
                  }}
                  onDragStart={() => setDragId(field.id)}
                  onDropOn={() => {
                    if (dragId) apply(dropFieldOn(definition, entity.id, dragId, field.id));
                    setDragId(null);
                  }}
                />
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              {CRM_FIELD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => apply(addField(definition, entity.id, type))}
                  className="border-brand-line text-caption rounded-pill border border-dashed px-3 py-2"
                >
                  ＋ {CRM_FIELD_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {/*
           * 從檔案建一類。
           *
           * 擺在欄位下面而不是最上面：先讓人看到「這裡在設計什麼」，
           * 再給捷徑。擺最上面的話，第一次來的人會以為一定要有檔案才能用。
           */}
          <ImportDesign
            definition={definition}
            onImported={(next) => {
              // 走 apply 這條路，所以復原／重做、跳到新那一類全都自動成立
              apply({ ok: true, definition: next });
              setSelectedFieldId(null);
            }}
          />

          {/* 選取的欄位 */}
          {selectedField ? (
            <FieldSettings
              field={selectedField}
              onChange={(patch) =>
                apply(updateField(definition, entity.id, selectedField.id, patch))
              }
            />
          ) : (
            <p className="text-caption text-brand-muted border-brand-line mt-6 rounded-lg border border-dashed p-4">
              點一個欄位的名字，可以改它的標題、說明、是不是必填。
            </p>
          )}

          {/*
           * 失敗的訊息用 role="alert"：操作被純函式擋下來時，畫面上
           * 唯一的變化就是「什麼都沒發生」——不說的話使用者會一直按。
           */}
          {state.error ? (
            <p role="alert" className="text-body-sm text-brand-accent-strong mt-4 font-bold">
              {state.error}
            </p>
          ) : null}

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "undo" })}
              disabled={state.past.length === 0}
              className="border-brand-line text-caption rounded-pill border px-4 py-2 disabled:opacity-30"
            >
              復原
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "redo" })}
              disabled={state.future.length === 0}
              className="border-brand-line text-caption rounded-pill border px-4 py-2 disabled:opacity-30"
            >
              重做
            </button>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* 預覽與存檔                                                        */}
        {/* ---------------------------------------------------------------- */}
        <section aria-labelledby="crm-preview-heading" className="flex flex-col gap-6">
          <h2 id="crm-preview-heading" className="text-heading-1">
            長這樣
          </h2>

          <CrmPreview entity={entity} />

          <CrmSaveBar
            signedIn={signedIn}
            definition={definition}
            savedId={state.savedId}
            onSaved={handleSaved}
          />
        </section>
      </div>
    </div>
  );
}

/** 選取那一個欄位的設定。刻意與清單分開：清單要短，設定要清楚 */
function FieldSettings({
  field,
  onChange,
}: {
  field: CrmField;
  onChange: (patch: Partial<Omit<CrmField, "id">>) => void;
}) {
  const inputClass =
    "border-brand-line bg-brand-paper text-body-sm mt-1 w-full rounded-md border px-3 py-2";

  return (
    <div className="border-brand-line mt-6 rounded-lg border p-4">
      <h3 className="text-body-sm font-bold">欄位設定</h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-caption text-brand-muted block">名字</span>
          <input
            value={field.label}
            onChange={(event) => onChange({ label: event.target.value })}
            maxLength={60}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-caption text-brand-muted block">型別</span>
          <select
            value={field.type}
            onChange={(event) => onChange({ type: event.target.value as CrmField["type"] })}
            className={inputClass}
          >
            {CRM_FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {CRM_FIELD_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-caption text-brand-muted block">下面那一行小字（可以留空）</span>
        <input
          value={field.hint}
          onChange={(event) => onChange({ hint: event.target.value })}
          maxLength={120}
          className={inputClass}
        />
      </label>

      <label className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(event) => onChange({ required: event.target.checked })}
        />
        <span className="text-body-sm">一定要填</span>
      </label>

      {field.type === "select" ? (
        <label className="mt-3 block">
          <span className="text-caption text-brand-muted block">
            選項，一行一個（最多 {CRM_LIMITS.optionsPerField} 個）
          </span>
          <textarea
            value={field.options.join("\n")}
            onChange={(event) =>
              onChange({
                options: event.target.value
                  .split("\n")
                  .map((option) => option.trim())
                  .filter(Boolean),
              })
            }
            rows={4}
            className={inputClass}
          />
        </label>
      ) : null}
    </div>
  );
}
