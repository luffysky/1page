import { describe, expect, it } from "vitest";

import { moveInOrder } from "./reorder";

describe("moveInOrder", () => {
  it("往上與往下各移一格", () => {
    expect(moveInOrder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("已經在頭尾時回 null，不繞到另一端", () => {
    /*
     * 繞回去的話，「一直按下移」會讓那一塊突然出現在最上面。
     * 那不是使用者要的，而且他會以為自己弄壞了什麼。
     */
    expect(moveInOrder(["a", "b", "c"], "a", "up")).toBeNull();
    expect(moveInOrder(["a", "b", "c"], "c", "down")).toBeNull();
  });

  it("不認得的項目回 null", () => {
    expect(moveInOrder(["a", "b"], "z", "up")).toBeNull();
  });

  it("不修改傳進來的陣列", () => {
    // 呼叫端把原陣列放在 state 裡。就地修改的話 React 看不到變化
    // （同一個參照），畫面不會更新——而資料其實已經動了
    const original = ["a", "b", "c"];
    moveInOrder(original, "a", "down");
    expect(original).toEqual(["a", "b", "c"]);
  });

  it("只有一項時哪個方向都不動", () => {
    expect(moveInOrder(["only"], "only", "up")).toBeNull();
    expect(moveInOrder(["only"], "only", "down")).toBeNull();
  });
});
