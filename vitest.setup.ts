import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 未開啟 vitest globals，RTL 的自動 cleanup 不會生效，這裡明確掛上。
afterEach(cleanup);
