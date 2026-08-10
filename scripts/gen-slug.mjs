import { randomInt } from "node:crypto";

/**
 * 後台密路徑產生器。
 *
 * 用法：
 *   pnpm gen:slug                          預設 16 碼、base58
 *   pnpm gen:slug --length 24
 *   pnpm gen:slug --format hex --length 32
 *   pnpm gen:slug --format words --length 4
 *   pnpm gen:slug --count 5                一次產生多組挑一個
 *
 * ── 為什麼用 crypto.randomInt 而不是 Math.random ──────────────
 * `Math.random()` 是可預測的偽隨機數：知道幾個輸出就能推算後續。
 * 拿它產生任何具保護作用的字串都等於沒有保護。
 *
 * 也刻意不用 `bytes[i] % alphabet.length`——除非字母表長度剛好整除 256，
 * 否則前面的字元會比後面的更常出現（模數偏差）。
 * `randomInt(max)` 內部以拒絕取樣處理，分佈是均勻的。
 */

const FORMATS = {
  /**
   * 預設。base58 排除掉 0 O I l 這些在不同字體下難以分辨的字元——
   * 這串路徑遲早要有人用眼睛核對或口頭傳達。
   */
  base58: {
    label: "base58（排除易混淆字元 0 O I l）",
    alphabet: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
  },
  alnum: {
    label: "小寫英數",
    alphabet: "abcdefghijklmnopqrstuvwxyz0123456789",
  },
  "alnum-mixed": {
    label: "大小寫英數",
    alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  },
  hex: {
    label: "十六進位",
    alphabet: "0123456789abcdef",
  },
  words: {
    label: "可讀單字（以連字號分隔）",
    alphabet: null,
  },
};

/** words 格式用。刻意挑無語意關聯的常見短字，避免猜測 */
const WORDS = [
  "amber",
  "basin",
  "cedar",
  "delta",
  "ember",
  "fable",
  "grove",
  "harbor",
  "ivory",
  "jetty",
  "kelp",
  "lumen",
  "marsh",
  "nimbus",
  "onyx",
  "prism",
  "quartz",
  "ridge",
  "slate",
  "thicket",
  "umber",
  "vellum",
  "willow",
  "xenon",
  "yarrow",
  "zephyr",
  "anvil",
  "brine",
  "cobalt",
  "dune",
  "elm",
  "flint",
];

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (name, fallback) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };

  return {
    format: get("format", "base58"),
    length: Number(get("length", "")) || null,
    count: Number(get("count", "1")) || 1,
    help: argv.includes("--help") || argv.includes("-h"),
  };
}

function usage() {
  console.log(`
後台密路徑產生器

  --format <名稱>   ${Object.keys(FORMATS).join(" | ")}    （預設 base58）
  --length <數字>   字元數；words 格式時為單字數        （預設 16 / 3）
  --count  <數字>   一次產生幾組                        （預設 1）

範例
  pnpm gen:slug
  pnpm gen:slug --length 24
  pnpm gen:slug --format words --length 4
  pnpm gen:slug --format hex --length 32 --count 5
`);
}

function generate(format, length) {
  if (format === "words") {
    return Array.from({ length }, () => WORDS[randomInt(WORDS.length)]).join("-");
  }

  const { alphabet } = FORMATS[format];
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");
}

/** 熵是判斷「夠不夠長」的唯一客觀依據，比「看起來很亂」可靠 */
function entropyBits(format, length) {
  const size = format === "words" ? WORDS.length : FORMATS[format].alphabet.length;
  return Math.floor(length * Math.log2(size));
}

const args = parseArgs();

if (args.help) {
  usage();
  process.exit(0);
}

if (!FORMATS[args.format]) {
  console.error(`未知格式：${args.format}`);
  usage();
  process.exit(1);
}

const length = args.length ?? (args.format === "words" ? 3 : 16);

if (length < 1) {
  console.error("長度必須大於 0");
  process.exit(1);
}

const bits = entropyBits(args.format, length);

console.log(`\n格式：${FORMATS[args.format].label}`);
console.log(`長度：${length}${args.format === "words" ? " 個單字" : " 字元"}`);
console.log(`熵　：約 ${bits} bits`);

if (bits < 64) {
  console.log(
    `\n⚠️  ${bits} bits 偏低。密路徑的作用是讓自動掃描找不到後台，\n` +
      `   建議至少 64 bits（base58 約 11 碼、hex 約 16 碼）。`,
  );
}

console.log("");
for (let i = 0; i < args.count; i += 1) {
  console.log(`  ${generate(args.format, length)}`);
}

console.log(`
寫進 .env.local：

  ADMIN_SEGMENT=<上面挑一組>

⚠️  不要加 NEXT_PUBLIC_ 前綴。
    加了會被打包進瀏覽器 JavaScript，等於把密路徑公開給所有訪客。

    另外也不要把它寫進 robots.txt 的 Disallow——robots.txt 是公開檔案，
    攻擊者讀它的主要目的就是找隱藏路徑。

    密路徑只是防掃描，不是安全邊界。真正的邊界是登入驗證與資料庫 RLS。
`);
