# 一頁起家 Web Platform V1 Implementation Spec

**Project:** 一頁起家  
**Version:** V1.4  
**Stack:** Next.js + TypeScript + Tailwind CSS + Framer Motion + Supabase  
**定位:** AI-assisted Digital Studio / Interactive Sales Platform  
**狀態:** 🔒 **FROZEN — Source of Truth**

> 本文件已封版。實作期間不得為了遷就實作方便而修改本文件。
>
> 若實作中發現規格有誤或不可行，流程為：
> 記錄於 §47 Change Request → 人工裁決 → 才升版本。
>
> 不接受「邊做邊改 Spec」。

> V1.2 變更（CR-001）：物件儲存由 Supabase Storage 改為 Cloudflare R2，影響 §1、§8.9、§36。
> V1.3 變更（CR-002）：開放公開註冊，新增會員帳號與帳號內聯繫功能，影響 §37、§38、§40。
> V1.4 變更（CR-003）：解禁 Widget 可拖曳編輯與擴充 Block，新增 AI 客服體驗 Widget，免費／付費的線改畫在「存檔」而非「編輯」，影響 §22、§23、§36、§40。
> V1.5 變更（CR-005）：首頁 IA 重新編排（Services 提前、Template 降位、Process/Pricing 對調），影響 §4。
> V1.6 變更（CR-006）：首頁瘦身——完整六級價格移至 `/pricing`、完整試穿移至 `/playground`，首頁各留精簡入口。影響 §8.15、§26.1、§26.2，並新增兩條路由。
>
> V1.1 變更：§3 視覺沿用政策、§4 IA 補回 Template Experience、§6 Goal Selector 升級為 Context Controller、新增 §8.15 Template Experience Section、§26 補上呈現形式約束、新增 §45 Demo 偏離清單。詳見 §46 Changelog。

---

## 0. V1 核心目標

一頁起家不是單純接案工作室官網。

V1 必須同時完成：

1. 展示服務與品牌能力
2. 官網本身作為 Demo #0
3. 讓訪客透過 AI Agent 探索需求
4. 讓 Agent 操作 Website Preview，展示 AI Website Workflow
5. 建立可持續累積的作品集系統
6. 將作品、Demo、客戶案與不同媒體格式統一管理與分類
7. 將訪客逐步導向付費 Workshop、正式委託與後續維護

核心 Funnel：

```text
Visitor
  ↓
Website / Service Discovery
  ↓
Portfolio / Demo Discovery
  ↓
Free AI Website Advisor
  ↓
Requirement Discovery
  ↓
Basic Website Preview
  ↓
Paid Boundary
  ↓
Website Workshop
  ↓
Qualified Lead
  ↓
Human Review
  ↓
Formal Project
  ↓
Maintenance
```

V1 不實作完整 AI Website SaaS。

---

# 1. 技術架構

```text
Next.js
└── App Router

TypeScript
Tailwind CSS
Framer Motion

Supabase
├── PostgreSQL
└── Auth

Cloudflare R2
└── Object Storage（S3 相容）

AI Layer
├── Agent Orchestrator
├── Intent Router
├── Conversation Policy
├── Tool Registry
└── Website Tools

Website Engine
├── SiteConfig Schema
├── Template Registry
├── Section Registry
├── Theme Registry
└── SiteRenderer

Portfolio Engine
├── Portfolio Registry
├── Category / Tag System
├── Media Upload
├── Project Detail Renderer
└── Featured Work
```

所有核心 domain logic 不應直接寫死在 page component。

---

# 2. 建議目錄

```text
src/
├── app/
│   ├── page.tsx
│   ├── services/
│   ├── templates/
│   ├── work/
│   │   ├── page.tsx
│   │   └── [slug]/
│   │       └── page.tsx
│   ├── workshop/
│   │   └── [projectId]/
│   ├── admin/
│   │   └── portfolio/
│   ├── api/
│   │   ├── agent/
│   │   ├── leads/
│   │   ├── preview/
│   │   └── portfolio/
│   └── layout.tsx
│
├── components/
│   ├── landing/
│   ├── agent/
│   ├── website-preview/
│   ├── services/
│   ├── pricing/
│   ├── portfolio/
│   └── shared/
│
├── features/
│   ├── agent/
│   ├── website-engine/
│   ├── portfolio/
│   ├── workshop/
│   ├── leads/
│   └── services/
│
├── lib/
│   ├── ai/
│   ├── supabase/
│   ├── storage/
│   ├── validation/
│   └── analytics/
│
├── config/
│   ├── services.ts
│   ├── pricing.ts
│   ├── templates.ts
│   ├── portfolio-categories.ts
│   └── agent-policy.ts
│
└── types/
```

---

# 3. Design Direction

## 3.0 Demo 沿用政策（V1.1 修訂）

`yipage_studio_v3_polished.html` 的**品牌層**保留，**實作層**全部重建。

保留：

```text
Warm Off-white / Near Black / Rocket Red 色彩系統
Editorial × Boutique Studio 的氣質定位
商業流程結構（Free → Workshop → Build → Care）
```

不保留：

```text
Demo 的 CSS（patch 疊 patch、重複 selector）
inline style / inline event handler
DOM manipulation
目前的 Section 組織與版面節奏
```

正式版重新建立 Grid、Typography Scale、Spacing、Motion 與 Section Composition。

> 保留靈魂，拆掉骨架重蓋。
>
> **不要把 Demo 的 HTML migrate 成 JSX。**

Demo 目前約 70% 完成度是視覺上的錯覺；其程式結構不足以承載 SiteConfig、Portfolio 資料層與 Agent 整合。

## 3.1 Section Rhythm（V1.1 新增）

禁止全站以卡片網格解決每一個 Section。

反模式：

```text
Section 標題 → 六張圓角卡
Section 標題 → 四張圓角卡
Section 標題 → 三張圓角卡
```

那是 SaaS Dashboard 的文法，不是精品工作室。

正式版必須交替使用：

```text
大字 Editorial
滿版作品
Split Layout
Interactive Canvas
Whitespace
Pricing Ladder
Dark CTA Block
```

單一頁面中，卡片網格 Section 不得連續出現超過兩次。

## Visual Identity

```text
Primary Background:
Warm Off-white

Primary Text:
Near Black

Accent:
Rocket Red

Secondary:
Warm Gray
```

視覺定位：

> Boutique Digital Studio × Startup Product × Editorial Design

避免：

- AI 紫藍漸層濫用
- 大量 Glassmorphism
- 每個 Section 都 Card
- Dashboard 感
- Template marketplace 感
- 傳統網頁設計公司感
- 過度科技感

## Typography

需要：

- 大型 Editorial Heading
- 明顯字級 hierarchy
- 大量 whitespace
- 高 contrast
- 中文閱讀優先

Hero H1 Desktop：

```text
72–112px
```

Mobile：

```text
44–64px
```

---

# 4. Homepage IA

```text
Navbar
↓
Hero
↓
Goal Selector                   ← 必須在它控制的四塊之前（見下方約束）
↓
Selected Work / Portfolio
↓
Services
↓
Website / Template Experience   ← 獨立 Section，不得併入 Agent
↓
AI Website Advisor
↓
AI Philosophy
↓
Process
↓
Pricing
↓
Final CTA
↓
Footer
```

> **V1.5（CR-005）調整**：Services 由第 8 位提到第 5 位、Template Experience
> 由第 5 位降到第 6 位、Process 與 Pricing 對調。原因見 §47 CR-005。

作品集應在首頁較前面出現，因為它是陌生客戶建立信任的重要證據。

**Goal Selector 必須排在 Selected Work / Services / Template Experience /
AI Website Advisor 之前，而且不得關閉。**

它是這四塊的 context controller（§6.1），而設定目標的唯一入口就在它裡面。
排到那四塊後面的話，訪客選了目標之後改變的是他已經捲過去的內容；
關掉的話，整個目標情境只剩 `?goal=` 的網址參數觸發得了——
等於一個做好了卻沒有入口的功能（§40 反覆出現的那種毛病）。

要把它移出首頁，必須先把設定目標的動作接到別的地方
（Final CTA／Project Builder／AI Advisor 其中之一）。那是一次獨立的變更。

**Template Experience 必須是獨立 Section，不可只存在於 Agent 面板內。**

理由：不想聊天的訪客也必須能自己完成
「看 Template → 選產業 → 換 Theme → 切 Desktop / Mobile → 決定要不要叫 Agent」。

Agent 的角色是**加速理解與操作**，不是模板體驗的唯一入口。

---

# 5. Hero

核心文案方向：

> # 從第一頁，開始你的生意。

Subcopy：

> 網站、品牌、內容、設計與 AI 自動化。  
> 從想法、設計到真正可以使用的產品。

Badge：

> AI-assisted · Human-reviewed

CTA：

```text
Primary:
看看你的網站可以長怎樣

Secondary:
看看我們做過什麼
```

Hero 本身應有高品質 Motion，但不要影響 LCP。

---

# 6. Goal Selector

顯示：

```text
我要一個網站
我要建立品牌
我要開始行銷
我要製作內容
我要導入 AI
我還不知道需要什麼
```

## 6.1 Goal Selector 是首頁的 Context Controller（V1.1 升級）

Goal Selector 不是六張漂亮墓碑，是整個首頁的狀態來源。

點擊一個 Goal 後，**同一頁面內的四個 Section 必須同步反應**：

```text
Goal: website
  ↓
Selected Work        → filter category = "web"
Template Experience  → 只顯示 web 類 templates
Services             → highlight "Web" 產品線
Agent CTA            → initialIntent = "website"
```

```text
Goal: ai
  ↓
Selected Work        → AI / Agent / Automation 案例
Template Experience  → product / saas templates
Services             → highlight "AI & Automation"
Agent CTA            → initialIntent = "ai"
```

## 6.2 實作機制（架構約束）

Goal 狀態**必須是 URL 驅動**，不得只存在於 React local state：

```text
/?goal=website
```

原因：

- 可分享、可作為廣告 Landing 進入點
- Server Component 可依 goal 預取對應 Portfolio / Template
- `goal_selected` analytics 有可靠來源
- 重新整理不會遺失情境

建議實作：

```ts
type HomeGoal =
  | "website"
  | "brand"
  | "marketing"
  | "content"
  | "ai"
  | "unsure"
```

首頁各 Section 從單一 context 讀取，不各自持有狀態：

```tsx
<HomeGoalProvider value={goal}>
  <SelectedWork />
  <TemplateExperience />
  <Services />
  <AgentSection />
</HomeGoalProvider>
```

Agent 開啟時帶入：

```ts
openAgent({
  initialIntent: goal
})
```

**這是 Phase 1 就必須決定的架構，不可後補。**
若首頁先做成各 Section 獨立靜態，之後導入 Goal 同步等同重寫首頁。

`goal = "unsure"` 時不套用任何 filter，直接引導至 Agent。

---

# 7. Service Model

對外四大產品線：

```text
Web
Brand & Design
Content & Growth
AI & Automation
```

## Web

V1 可承接：

- One-page Website
- Landing Page
- Portfolio
- Brand Website
- UI/UX
- Website Optimization

V1 暫不承接：

- E-commerce
- Payment
- Logistics
- Complex Membership
- ERP
- POS
- Large Admin System
- Mission-critical Systems

---

# 8. Portfolio / 作品集系統

作品集是 V1 必要功能，不使用硬編碼陣列作為長期方案。

系統必須允許管理者上傳與管理各種類型作品，不限制只有網站。

## 8.1 支援的作品類型

至少支援：

```text
Website
Landing Page
UI / UX
Brand Identity
Logo
Graphic Design
Social Media
Advertising Creative
SEO / Content
Copywriting
Video
Short Video
Motion
AI Workflow
AI Agent
Automation
Prototype
Presentation
Other
```

作品類型不可寫死在 UI。

應由 category / taxonomy configuration 管理。

---

# 8.2 作品來源類型

每件作品必須標記：

```ts
type PortfolioProjectType =
  | "client"
  | "concept"
  | "demo"
  | "internal"
```

顯示名稱：

```text
Client Project
Concept Project
Demo
Internal Product
```

不得將 Demo / Concept 冒充真實客戶案例。

---

# 8.3 作品媒體格式

一個作品可混合上傳：

- JPG
- PNG
- WebP
- GIF
- SVG（需安全處理）
- MP4
- WebM
- PDF
- 外部影片連結
- Live Website URL
- Figma / Prototype URL
- GitHub URL（如適用）
- 其他外部展示 URL

支援：

```text
Cover
Gallery
Video
Before / After
Mobile Screenshot
Desktop Screenshot
Document
External Link
Live Demo
```

不要把 Portfolio 限制成「只能一張封面圖」。

---

# 8.4 Portfolio Data Model

```ts
interface PortfolioProject {
  id: string
  slug: string

  title: string
  summary?: string
  description?: string

  projectType:
    | "client"
    | "concept"
    | "demo"
    | "internal"

  status:
    | "draft"
    | "published"
    | "archived"

  categories: string[]
  tags: string[]

  services: string[]

  industry?: string

  year?: number

  cover: PortfolioMedia

  media: PortfolioMedia[]

  links?: {
    live?: string
    demo?: string
    figma?: string
    github?: string
    external?: string[]
  }

  caseStudy?: {
    problem?: string
    goal?: string
    thinking?: string
    solution?: string
    result?: string
  }

  aiDisclosure?: {
    used: boolean
    description?: string
  }

  featured: boolean
  sortOrder?: number

  createdAt: string
  updatedAt: string
}
```

---

# 8.5 Portfolio Media Model

```ts
interface PortfolioMedia {
  id: string

  type:
    | "image"
    | "video"
    | "pdf"
    | "embed"
    | "external"

  url: string

  thumbnailUrl?: string

  alt?: string
  caption?: string

  role?:
    | "cover"
    | "gallery"
    | "mobile"
    | "desktop"
    | "before"
    | "after"
    | "document"
}
```

---

# 8.6 作品分類

分類必須支援多選。

V1 預設大分類：

```text
Web
UI / UX
Brand
Graphic
Content
Social
Advertising
Video
AI
Automation
Internal Product
```

第二層可用 tags 處理：

```text
Landing Page
Restaurant
Beauty
SaaS
Minimal
Luxury
Next.js
Agent
RAG
SEO
Logo
Instagram
```

不要建立過深 category tree。

V1 採：

```text
Category + Tags
```

即可。

---

# 8.7 Portfolio Filter

作品集列表至少可篩：

```text
All
Web
UI/UX
Brand
Content
Social
Advertising
Video
AI
Automation
```

另可依：

- Project Type
- Industry
- Tag
- Service

篩選。

Desktop 可用水平 filter。

Mobile 使用橫向 Scroll Chips 或 Bottom Sheet。

---

# 8.8 Portfolio Admin

建立：

```text
/admin/portfolio
```

僅 Admin 可使用。

支援：

```text
Create
Edit
Preview
Publish
Unpublish
Archive
Delete
Reorder
Feature / Unfeature
```

作品編輯介面：

```text
Basic Info
↓
Category / Tags
↓
Services
↓
Media Upload
↓
Links
↓
Case Study
↓
AI Disclosure
↓
SEO
↓
Preview
↓
Publish
```

---

# 8.9 Media Upload

使用 **Cloudflare R2**（S3 相容物件儲存）。

> V1.2 變更（CR-001）：原訂 Supabase Storage，改為 Cloudflare R2。
> 詳見 §47 Change Request 紀錄。

## ⚠️ R2 沒有 RLS —— 授權模型與資料庫不同

Supabase Storage 與資料庫共用同一套 RLS，policy 是宣告式的。
R2 沒有這個機制。因此：

```text
資料庫授權   Supabase RLS（宣告式，policy 寫在 migration）
物件儲存授權 只剩我們自己的 server 在把關
```

**上傳一律經由自家 server route 驗證 admin 身分後簽發 presigned URL。**

禁止：

```text
❌ 前端直接持有 R2 access key
❌ 未經驗證即可呼叫的 presign endpoint
❌ 公開可列舉（list）的 bucket
```

若哪天有人加了一個不檢查身分的 presign endpoint，那就等同開放公開寫入——
資料庫那側的 RLS 完全保護不到這裡。這是 §41「不要只靠前端隱藏按鈕」
在物件儲存上的對應要求。

流程：

```text
Select files
↓
Client validation
↓
Upload
↓
Server validation
↓
Metadata save
↓
Thumbnail / Preview
```

需要：

- MIME type validation
- File size validation
- Filename sanitize
- Unique storage path
- Upload progress
- Failed upload retry
- Remove / replace
- Drag reorder

建議 path：

```text
portfolio/{projectId}/{uuid}.{ext}
```

---

# 8.10 Portfolio Detail Page

URL：

```text
/work/{slug}
```

內容不要只是 Gallery。

標準 Case Study Layout：

```text
Hero
↓
Project Meta
↓
Problem
↓
Goal
↓
Thinking
↓
Solution
↓
Media Gallery
↓
Result
↓
Services Used
↓
AI Disclosure
↓
Related Projects
↓
CTA
```

如果沒有完整 Case Study 資料，只顯示存在的區塊。

不要顯示空 Section。

---

# 8.11 Portfolio 首頁展示

首頁只顯示：

```text
Featured Projects
```

建議 3～6 件。

混合展示：

- Demo
- Internal Product
- Client Work

但必須明確標記類型。

首頁目的：

> 一眼證明我們真的做得出來。

---

# 8.12 Portfolio 與 Agent 整合

Agent 可使用：

```text
search_portfolio()
recommend_portfolio()
get_portfolio_project()
```

例如使用者：

> 你們有做過餐飲網站嗎？

Agent：

```text
search_portfolio({
  category: "web",
  industry: "food"
})
```

再回傳符合案例。

如果只有 Demo，要明確說：

> 目前有相關 Concept / Demo，可先看方向。

不可說成客戶案例。

---

# 8.13 Portfolio 與 Service 整合

每個作品可關聯：

```text
services[]
```

因此 Service Detail 可以自動顯示：

```text
Related Work
```

例如：

```text
/service/web
```

自動抓：

```text
services contains "web"
```

---

# 8.14 Portfolio 與 Template Engine 整合

網站類作品可選擇標記：

```text
sourceTemplateId
```

若某個客戶網站抽象化後變成模板：

```text
Portfolio Project
↓
Reusable Pattern
↓
Template / Section Library
```

但不得直接複製客戶機密或專有內容。

---

# 8.15 Template Experience Section（V1.1 新增）

首頁獨立 Section，位於 Selected Work 與 AI Advisor 之間。

## 目的

> 讓訪客在不與 Agent 對話的前提下，自己完成一次「試穿」。

## 功能範圍

允許：

```text
瀏覽 3～6 套 Template
依 Goal / 產業篩選
切換 Theme
切換 Accent Color
切換 Desktop / Tablet / Mobile
進入 Agent 並帶入目前 Template + Theme
進入 Project Builder 並帶入目前 SiteConfig
```

不允許（V1 非目標，見 §40）：

```text
拖拉編輯
新增 / 刪除 Section
自由編輯文案
匯出程式碼
儲存（未付費）
```

## 架構約束

此 Section 與 Agent Preview、Workshop Preview **必須共用同一個 `<SiteRenderer />`**（見 §11）。

不得為首頁另外寫一份「假的 Template 預覽」。

所有切換操作皆為 SiteConfig mutation：

```text
User Click
  ↓
SiteConfig Patch
  ↓
SiteRenderer
  ↓
Preview
```

**禁止直接操作 DOM style。**

## 與 Agent 的銜接

Template Experience 底部固定提供：

```text
「想讓 AI 幫你調整？」 → openAgent({ initialIntent: "template", siteConfig })
```

訪客在此累積的 SiteConfig 必須能無損傳入 Agent 與 Project Builder，
不可要求訪客重新選一次。

## Analytics

```text
template_viewed
template_switched
theme_switched
preview_device_switched
template_to_agent_clicked
```

---

# 9. Website Engine

Agent 禁止直接修改 React source code。

Agent 只操作結構化 SiteConfig。

```ts
interface SiteConfig {
  id: string

  brand: {
    name: string
    tagline?: string
    logo?: string
    industry?: string
  }

  theme: ThemeConfig

  sections: SiteSection[]

  settings: {
    language: string
    seo?: SEOConfig
  }
}
```

---

# 10. Section Model

```ts
interface SiteSection {
  id: string

  type:
    | "hero"
    | "about"
    | "services"
    | "features"
    | "gallery"
    | "portfolio"
    | "pricing"
    | "testimonials"
    | "faq"
    | "cta"
    | "contact"
    | "map"
    | "footer"

  variant: string

  content: Record<string, unknown>

  settings?: Record<string, unknown>
}
```

每種 Section 支援 variants。

例如：

```text
hero.centered
hero.editorial
hero.split
hero.image-heavy
hero.minimal
```

---

# 11. SiteRenderer

唯一正式 Rendering 入口：

```tsx
<SiteRenderer config={siteConfig} />
```

流程：

```text
SiteConfig
   ↓
Schema Validation
   ↓
Theme Resolver
   ↓
Section Resolver
   ↓
Section Components
   ↓
Rendered Website
```

Preview 與正式 Template Website 必須共用 renderer。

---

# 12. Template Engine

Template 應由：

```text
Layout
+
Section Composition
+
Section Variants
+
Theme
+
Default Content Schema
```

組成。

```ts
interface WebsiteTemplate {
  id: string
  name: string
  category: string[]
  recommendedIndustries: string[]

  defaultTheme: string

  sections: TemplateSectionConfig[]
}
```

---

# 13. Template V1

第一版只做 3～6 套高品質 Template。

建議：

### Studio
設計、顧問、企業服務。

### Local Business
餐廳、美容、咖啡店、工作室。

### Personal
創作者、攝影師、顧問、Portfolio。

### Premium Brand
高端品牌、室內設計、精品服務。

### Product
Startup / SaaS / Product Landing Page。

---

# 14. Theme Engine

Theme 與 Layout 分離。

```ts
interface ThemeConfig {
  colors: {
    background: string
    surface: string
    text: string
    muted: string
    accent: string
  }

  typography: {
    heading: string
    body: string
  }

  radius: string
  spacingScale: string
}
```

---

# 15. Website Preview

訪客可以免費修改：

```text
Brand Name
Industry
Theme
Accent Color
```

並查看：

```text
Desktop
Tablet
Mobile
```

所有 Preview 操作更新 SiteConfig，不直接 manipulate DOM。

---

# 16. AI Website Advisor

免費 Agent。

目的：

> 理解需求，而不是提供免費通用 AI。

允許：

- Service FAQ
- Pricing
- Portfolio / Case Study
- Template Recommendation
- Requirement Discovery
- Basic Marketing Discussion
- Basic Website Direction
- Basic Preview
- Lead Qualification

---

# 17. Agent Scope Policy

```ts
type AgentIntent =
  | "service_question"
  | "pricing"
  | "portfolio"
  | "requirement_discovery"
  | "template"
  | "website_preview"
  | "project"
  | "adjacent"
  | "casual"
  | "unclear"
  | "out_of_scope"
  | "abuse"
```

### IN_SCOPE
完整回答。

### ADJACENT
如果會影響專案，可深入。

### CASUAL
簡短自然回應，1～2 輪後適度拉回服務。

### UNCLEAR
禁止直接拒絕，先確認意圖。

### OUT_OF_SCOPE

例如：

```text
寫作業
寫小說
規劃旅遊
無關程式 Debug
翻譯大量文件
純陪聊
```

不完成完整工作。

---

# 18. Agent State Machine

```text
DISCOVER
   ↓
UNDERSTAND
   ↓
QUALIFY
   ↓
RECOMMEND
   ↓
PORTFOLIO / PREVIEW
   ↓
ESTIMATE
   ↓
CONVERT
   ↓
HUMAN_HANDOFF
```

不可強制線性。

---

# 19. Lead Schema

```ts
interface Lead {
  contact?: {
    name?: string
    email?: string
    phone?: string
  }

  business: {
    name?: string
    industry?: string
    description?: string
  }

  requirement: {
    service?: string[]
    goal?: string
    deadline?: string
    budgetRange?: string
  }

  assets: {
    logo?: boolean
    photos?: boolean
    copy?: boolean
    instagram?: string
    existingWebsite?: string
  }

  website?: {
    selectedTemplate?: string
    preferredTheme?: string
    previewConfig?: SiteConfig
  }

  qualification?: {
    confidence: number
    recommendedService?: string
  }
}
```

---

# 20. Agent Tool Permission

免費 Agent 第一版允許：

```text
search_services
search_faq
search_portfolio
get_portfolio_project
recommend_portfolio

recommend_service
recommend_template

get_template
update_preview

collect_requirement
update_requirement

estimate_price_range

create_lead_summary
request_human_handoff
```

禁止：

```text
arbitrary_web_search
shell
code_execution
arbitrary_email
database_raw_query
```

---

# 21. Agent 操作 Website

例如：

User：

> 我想要高級甜點店，但不要太黑。

Agent：

```text
set_industry("dessert")

set_theme("warm-luxury")

set_template("premium-brand")
```

Preview 更新。

---

# 22. Website Agent Tools

預留：

```ts
set_brand()

set_theme()

set_template()

add_section()

remove_section()

reorder_sections()

update_section_content()

set_section_variant()

generate_copy()

reset_preview()
```

所有 tool input 必須 Schema Validate。

---

# 23. 免費 / 付費邊界

不要按訊息數收費。

> 聊天免費，開始產生成果時收費。

> **V1.4 變更（CR-003，選項 B）：線改畫在「存檔」而非「編輯」。**
>
> 訪客可以免費拖曳編輯、看到完整結果——**但不付費就留不住**。
> 離開頁面即消失，不能存檔、不能匯出、不能取得正式的 SiteConfig。
>
> 理由：讓人先把東西做出來再收費，比讓他想像那東西長什麼樣子再收費有效得多。
> 「你調了半天的成果要留下來」是一個對方自己就能算清楚的理由。

## Free Advisor

允許：

- FAQ
- Portfolio
- Requirement Discovery
- Service Recommendation
- Pricing Range
- Template Recommendation
- Basic Preview

## Paid Website Workshop

開始：

- Deep Requirement Interview
- Website Blueprint
- Section Architecture
- Complete Copy Draft
- Multiple Theme/Layout Iterations
- Agent Website Editing
- Saved Project
- Full Preview

---

# 24. Website Workshop

暫定：

> NT$990 起

價格 Config 化：

```ts
workshopPrice
```

Workshop 成果：

```text
Requirement Summary
Website Blueprint
Section Structure
Design Direction
Copy Draft
SiteConfig
Live Preview
```

正式委託時 Workshop 費用可折抵。

---

# 25. V1 Payment

V1 Demo 階段不需要真的串金流。

先：

```text
Unlock Workshop
↓
Pricing Modal
↓
Explain Deliverables
↓
CTA / Lead
```

市場驗證後再接 Payment Provider。

---

# 26. 正式建站產品

```text
AI Advisor
FREE

Website Workshop
NT$990+

Template Build
NT$8,800+

Semi-Custom
NT$15,800+

Custom
NT$30,000+

Strategy + Design + Build
Custom Quote
```

價格全部從：

```text
config/pricing.ts
```

取得。

## 26.1 六級必須完整（V1.1 強調）

**不可省略 Template Build 與 Semi-Custom。**

這兩級是 990 與 30,000 之間唯一的承接點。缺了它們，
訪客的升級路徑等同從 NT$990 直接跳 NT$30,000，轉換會斷在這裡。

完整升級路徑：

```text
Free Advisor
  → Website Workshop      990+
  → Template Build      8,800+
  → Semi-Custom        15,800+
  → Custom             30,000+
  → Strategy          專案報價
```

V3 Demo 只呈現 4 級，屬於偏離，不可沿用（見 §45）。

## 26.2 呈現形式約束（V1.1 新增）

六級**不得**做成六張等寬圓角卡並排——那正是 §3.1 禁止的卡片文法，
且六欄在 1280px 以下無法閱讀。

建議呈現：

```text
分兩組敘事

  A. 先想清楚          Advisor(Free) / Workshop(990+)
  B. 開始建站          Template Build / Semi-Custom / Custom / Strategy
```

或使用縱向 Ladder / 對照表，強調「責任範圍遞增」而非「功能打勾比較」。

呼應 §27：價格依責任範圍，不依頁數。呈現方式也應傳達責任遞增，
而不是 SaaS 方案比較表。

---

# 27. Pricing Philosophy

> 價格依責任範圍，而非單純依頁數。

定價依：

```text
Scope
Complexity
Responsibility
Customization
Risk
Delivery
```

---

# 28. AI Disclosure

全站統一：

> AI-assisted · Human-reviewed

核心說明：

> 我們會合理使用 AI 協助研究、內容整理、設計探索與程式開發。AI 是生產工具，正式交付成果仍經人工判斷、測試與品質確認。

---

# 29. Demo / Client Project 標示

作品必須有：

```ts
type: "concept" | "demo" | "client" | "internal"
```

禁止拿 Demo 冒充客戶案例。

---

# 30. Project Builder

Final CTA：

> 你不需要先知道怎麼做。  
> 只需要告訴我們，你想完成什麼。

欄位：

```text
Service
Business
Goal
Budget
Deadline
Assets
Description
```

如果從 Agent / Template / Portfolio 進入，自動帶：

```text
Agent Lead Context
Selected Template
Selected Portfolio Reference
Theme
SiteConfig
```

---

# 31. Analytics

至少追：

```text
hero_cta_clicked

goal_selected

portfolio_viewed
portfolio_filtered
portfolio_project_opened
portfolio_live_demo_clicked

agent_opened
agent_message_sent

template_viewed
template_switched
theme_switched
preview_device_switched
template_to_agent_clicked
preview_modified

workshop_gate_shown
workshop_cta_clicked

lead_started
lead_submitted

pricing_viewed
```

---

# 32. SEO

Next Metadata API。

至少：

- title
- description
- OG
- canonical
- sitemap
- robots
- structured data

Portfolio detail 需有獨立 metadata。

---

# 33. Performance

目標：

```text
LCP < 2.5s
CLS < 0.1
INP < 200ms
```

避免：

- Hero 大影片 blocking
- 首屏載入 Agent model
- 一開始載入全部 Portfolio media
- 一開始載入全部 Template
- 大量 Framer Motion client components

作品圖片使用 Next Image / responsive size。

影片 lazy load。

---

# 34. Responsive

至少驗證：

```text
375
390
430
768
1024
1280
1440
1920
```

---

# 35. Accessibility

至少：

- Semantic HTML
- Keyboard navigation
- Visible focus
- aria-label
- color contrast
- prefers-reduced-motion
- form error messages
- alt text
- Portfolio gallery keyboard navigation
- Agent messages accessible

---

# 36. Security

Agent：

- Tool whitelist
- Zod validation
- rate limiting
- input length limit
- conversation budget
- prompt injection handling

Preview：

- 禁止 arbitrary HTML
- 禁止 arbitrary JS
- 禁止 script injection
- URL validation
- image source validation

Portfolio Upload（R2，見 §8.9）：

- MIME allowlist
- file size limit
- extension validation
- SVG sanitize or disable raw inline rendering
- filename sanitize
- presigned URL 由 server 簽發，簽發前驗證 admin
- presigned URL 短期有效
- bucket 不可公開列舉
- admin-only write permission（由 server 強制，非 R2 policy）

---

# 37. Anonymous Agent Limits

匿名：

```text
short context
rate limit
message/session limit
basic model routing
```

Qualified Lead 可以提高 Context。

已登入會員（V1.3 新增）：對話與詢問綁定帳號，可回頭查看歷史紀錄與回覆。
額度不低於匿名，但**不因為登入就無上限**——濫用防護與匿名共用同一套。

---

# 38. Supabase V1 Tables

最低限度：

```text
leads

agent_sessions
agent_messages

templates
template_versions

website_previews

workshop_projects

portfolio_projects
portfolio_media
portfolio_categories
portfolio_tags
portfolio_project_categories
portfolio_project_tags
```

後續才加：

```text
customers
projects
payments
maintenance_contracts
```

---

# 39. Portfolio Database 建議

## portfolio_projects

```text
id
slug
title
summary
description
project_type
status
industry
year
featured
sort_order
case_study_json
links_json
ai_disclosure_json
created_at
updated_at
published_at
```

## portfolio_media

```text
id
project_id
type
url
thumbnail_url
alt
caption
role
sort_order
created_at
```

## portfolio_categories

```text
id
slug
name
sort_order
active
```

## portfolio_tags

```text
id
slug
name
```

使用 join tables 實作 many-to-many。

---

# 40. V1 非目標

明確禁止 Scope Creep：

```text
❌ 完整 CMS 平台
❌ Wix-like Drag & Drop Editor
❌ Code Export
❌ Production AI Website SaaS
❌ E-commerce
❌ Payment integration
❌ Client Portal
❌ Complex CRM
❌ Full Project Management
❌ Multi-agent autonomous development
❌ Arbitrary website generation
❌ 自動正式報價
❌ Agent 自動簽約
❌ Portfolio 公開投稿
❌ 讓非 Admin 任意上傳作品
```

> V1.4 變更（CR-003）：三條禁令修訂。
>
> **移出禁令**：完整 CMS 平台（限縮為「網站編輯」，不含多站台、權限矩陣、工作流）、
> Wix-like Drag & Drop Editor（要求同時可鍵盤操作，見 §35）。
>
> **部分解禁**：Production AI Website SaaS。模板內的 **AI 客服體驗 Widget** 解禁；
> 真正部署給客戶、含知識庫與用量計費的 AI 客服產品**仍是非目標**，另行提 CR。
>
> **不解禁**：`html` 與 raw `embed` block。理由不是範圍是安全——
> Preview 渲染的是使用者輸入的內容，任意 HTML 等於自開 XSS。
> 改以**白名單嵌入**取代：只接受「提供者 + ID」，由系統組出 sandbox iframe（見 §36）。

> V1.3 變更（CR-002）：Client Portal 移出禁令。
> 但只解禁到**帳號 + 帳號內聯繫**為止，範圍見 §47 CR-002 的「界線」一節。
> 進度追蹤、檔案交付、報價審批、簽核流程仍然是非目標——
> 那些一旦開始做就會把 V1 變成專案管理系統。

作品集 V1 是內部管理工具，不是 Behance。

---

# 41. Admin Permission

作品管理第一版只允許 Admin。

需要：

```text
/admin/portfolio
```

route guard。

若使用 Supabase：

- admin role / allowlist
- RLS
- Storage policy
- Server-side authorization

不要只靠前端隱藏按鈕。

---

# 42. V1 Definition of Done

## Website

- [ ] 正式 Brand UI
- [ ] Desktop / Mobile 完整
- [ ] Hero
- [ ] Goal Selector
- [ ] Services
- [ ] Pricing
- [ ] Process
- [ ] CTA
- [ ] Project Builder

## Portfolio

- [ ] Portfolio List
- [ ] Category Filter
- [ ] Tags
- [ ] Detail Page
- [ ] Featured Work on Homepage
- [ ] Admin Create / Edit
- [ ] Media Upload
- [ ] Mixed Media
- [ ] Client / Demo / Internal labels
- [ ] Service relation
- [ ] Agent search support

## Website Engine

- [ ] SiteConfig Schema
- [ ] Theme Engine
- [ ] Section Registry
- [ ] SiteRenderer
- [ ] ≥3 Templates
- [ ] Desktop/Mobile Preview

## Agent

- [ ] Free Advisor UI
- [ ] Streaming response
- [ ] Intent classification
- [ ] Scope policy
- [ ] Requirement collection
- [ ] Portfolio recommendation
- [ ] Template recommendation
- [ ] Preview tools
- [ ] Price range
- [ ] Paid boundary
- [ ] Human handoff

## Data

- [ ] Lead persistence
- [ ] Agent Session
- [ ] Portfolio persistence
- [ ] Storage
- [ ] Analytics

---

# 43. Implementation Order

不要一次讓大量子 Agent 全面平行開發。

## Phase 1

```text
Project Scaffold

Design Tokens
├── color
├── typography
├── spacing
├── radius
├── shadow
├── container
├── breakpoint
└── motion

Layout Primitives
├── Navbar（含 Mobile Nav）
├── Hero
├── Editorial Section
├── Portfolio Layout
├── Template Experience Shell
├── Agent Workspace Shell
├── Pricing Ladder
└── Dark CTA Block

Home Goal Context（URL-driven，見 §6.2）
Responsive
```

Design Tokens 必須先於任何 Section 實作完成，不可邊做邊補。

Home Goal Context 必須在 Phase 1 建立骨架，即使各 Section 尚未接資料——
這是結構性決策，後補等同重寫首頁。

## Phase 2

```text
Portfolio Schema
Portfolio Admin
Media Upload
Portfolio List / Detail
```

先把作品展示能力建立，因為這直接影響接案信用。

## Phase 3

```text
SiteConfig
Section Registry
Theme Engine
SiteRenderer
```

## Phase 4

```text
3 Templates
Preview
Template Switching
```

## Phase 5

```text
Agent UI
Intent Router
Conversation Policy
Service / Portfolio Knowledge
```

## Phase 6

```text
Agent Website Tools
Preview Control
Lead Collection
```

## Phase 7

```text
Workshop Gate
Project Builder
Analytics
```

## Phase 8

```text
QA
Accessibility
Performance
SEO
Security
Production Deploy
```

---

# 44. 最重要的 Architecture Decisions

## Website

> AI Agent 不生成網站程式碼。  
> AI Agent 生成與修改結構化 SiteConfig。  
> Website Engine 將 SiteConfig Render 成網站。

```text
User Intent
     ↓
Agent
     ↓
Validated Tool Call
     ↓
SiteConfig Mutation
     ↓
Website Engine
     ↓
Live Preview
```

不要：

```text
User
↓
LLM
↓
現場亂寫 React
↓
祈禱
```

## Portfolio

> Portfolio 不應依賴 hardcoded JSX。  
> 所有作品必須由資料層管理，媒體與分類可持續新增。

```text
Admin Upload
     ↓
Validation
     ↓
Supabase Storage
     ↓
Portfolio Metadata
     ↓
Category / Tags
     ↓
Portfolio Renderer
     ↓
Homepage / Work / Service / Agent
```

作品集本身也必須成為一頁起家的可累積資產。

每完成一個新專案：

```text
正式交付
↓
確認可公開內容
↓
建立 Portfolio Project
↓
整理 Case Study
↓
抽象可重用設計
↓
回流 Template / Section Library
```

形成：

> 接案 → 作品 → 信用 → 更多接案 → 模板資產 → 更高生產效率

這是 V1 應保留的長期飛輪。

---

# 45. V3 Demo 偏離清單（V1.1 新增）

`yipage_studio_v3_polished.html` 是概念驗證，**以下各點偏離本 Spec，實作時不得沿用**。

列出的目的是避免實作者「照著 Demo 做」而繞過既有規範。

## 45.1 違反既有規範

| Demo 現況 | 違反 | 正確做法 |
|---|---|---|
| 首頁價格只有 4 級（缺 Template Build、Semi-Custom） | §26 | 完整六級 |
| Preview 以 `element.style.background = ...` 切換主題 | §15 | SiteConfig mutation → SiteRenderer |
| 作品為 CSS 漸層佔位、無 slug、無連結 | §8 | 資料層驅動、`/work/{slug}` |
| Goal Selector 為純靜態卡片、無行為 | §6 | Context Controller |
| Template 體驗只存在於 Agent 面板內 | §4 | 獨立 Section |
| Hero 次要 CTA 為「瀏覽所有服務」 | §5 | 「看看我們做過什麼」——導向作品才符合信任策略 |
| 900px 以下導覽列直接 `display:none`，無替代 | §34 | Mobile Nav |
| 無 `prefers-reduced-motion`、chat 無 `aria-live`、input 無 label | §35 | A11y 基線 |
| 作品區無 `alt`（純 CSS 背景） | §35 | 語意化 + alt |

## 45.2 實作品質問題（不可移植的原因）

```text
CSS 兩段互相覆蓋（.hero / .hero-card / .section-head 各定義兩次）
.chip / .scope-note / .paid-label 三個 class 無任何 CSS 定義
font-family 宣告 Inter 但未載入任何字體資源
font-weight 使用 750 / 950 / 1000 等非標準值（實際無效）
inline event handler（onsubmit / onclick）
inline style 散佈於 markup
無 token system
Section 全部以卡片網格解決（違反 §3.1）
```

## 45.3 Demo 做對、應保留的部分

```text
Warm Off-white / Near Black / Rocket Red 色彩系統
作品卡明確標示 DEMO / INTERNAL（符合 §8.2、§29）
Funnel Strip 的 Free → Paid → Build → Care 敘事
Workshop Gate 的付費邊界表達方式
AI Philosophy 的「只會用 AI」vs「一頁起家工作方式」對照
```

---

# 46. V1.1 Changelog

```text
§3    新增 3.0 Demo 沿用政策（取代「不沿用視覺設計」）
§3    新增 3.1 Section Rhythm，禁止全站卡片網格
§4    IA 標註 Template Experience 必須獨立於 Agent
§6    新增 6.1 / 6.2，Goal Selector 升級為 URL-driven Context Controller
§8.15 新增 Template Experience Section 規格
§26   新增 26.1 六級完整性、26.2 呈現形式約束
§43   Phase 1 展開 Design Tokens、Layout Primitives、Home Goal Context
§45   新增 V3 Demo 偏離清單
```

## 未變更但需注意

以下項目在 V1（原版）**已規範正確**，V1.1 不重複敘述。
若實作偏離，是實作問題，不是 Spec 缺漏：

```text
§5   Hero 文案與 CTA
§8   Portfolio 資料層驅動
§15  Preview 必須 SiteConfig 驅動
§26  六級價格階梯（原本就完整）
§34  Responsive 斷點
§35  Accessibility
§36  Security
```

## 優先序

```text
P0（架構性，錯了要重寫）
  Home Goal Context（URL-driven）
  Design Tokens
  Template Experience 獨立 Section
  SiteRenderer 單一入口
  Portfolio 資料層

P1（轉換性，可在 Phase 1–2 內修正）
  完整六級價格與呈現形式
  Hero CTA 文案
  Mobile Nav
  A11y 基線
  Editorial Typography / 降低卡片密度
  Portfolio Filter、/work/[slug]

P2
  Workshop Unlock
  Persistence
  Analytics
  Deeper Agent Tools
```

P0 與 P1 的區分依據是**「不先做會不會造成重寫」**，不是重要性。
六級價格很重要，但它是 config 修改；Goal Context 沒那麼「醒目」，
卻決定首頁能不能組裝起來。


---

# 47. Change Request 紀錄

封版後的規格變更一律記錄於此。流程見文件開頭：
發現問題 → 停止該項實作 → 提 CR → 人工裁決 → 升版本 → 恢復實作。

## CR-006 — 首頁瘦身：完整價格與完整試穿各自獨立成頁

| 項目 | 內容 |
|---|---|
| 日期 | 2026-08-18 |
| 影響章節 | §8.15、§26.1、§26.2（並新增 `/pricing`、`/playground` 兩條路由） |
| 原規格 | 六級價格必須完整呈現**在首頁**；Template Experience 的完整功能範圍在**首頁那一段** |
| 變更為 | 首頁各留一段**精簡入口**，完整內容移到 `/pricing` 與 `/playground` 兩條新路由 |
| 裁決 | Luffy 裁決採用 |
| 版本 | V1.5 → V1.6 |

**動機**：接續 CR-005。`docs/gptsay.md` 的核心批評是
「太忠實地把 Spec 每一項都畫成一個 Section」，而首頁上體積最大的兩塊
正是六級價格與 Template Experience。CR-005 只調了順序，沒有解決體積。

### ⚠️ §26.1 的原意要保留，變的只是位置

原文的理由是：

> 缺了它們，訪客的升級路徑等同從 NT$990 直接跳 NT$30,000，轉換會斷在這裡。

**那個顧慮是「階梯有缺口」，不是「階梯放在哪一頁」。**
所以這次的界線是：

```text
仍然必須成立   六級完整、順序正確、兩個承接點都在 → 在 /pricing
新的要求       首頁那一段必須把「起價」與「往下看完整階梯」都講清楚，
               而且連結要顯眼。藏起來就等於缺了它們
仍然禁止       六張等寬卡並排（§26.2 不變，/pricing 也適用）
```

### §8.15 的功能範圍拆成兩處

```text
首頁（精簡）      挑模板 + 大張預覽 + 兩個出口
                  （「完整設定」→ /playground、「帶著設定去問 AI」→ #advisor）
/playground（完整） 原本 §8.15「允許」清單的全部：
                  篩選、Theme、Accent、Desktop/Tablet/Mobile、
                  帶進 Agent、帶進 Project Builder
```

⚠️ **§8.15 的架構約束完全不變**：兩處都必須共用同一個 `<SiteRenderer />`，
所有切換皆為 SiteConfig mutation，禁止直接操作 DOM style。
**不得為 /playground 另外寫一份預覽。**

⚠️ 「不想聊天的訪客也必須能自己完成一次試穿」這條**仍然成立**——
只是完整的那次試穿改在 `/playground`，而首頁到那裡是一個連結的距離。
`/playground` 不需要登入、不需要付費、不經過 Agent。

### 兩條新路由要有畫面上的入口

`audit:wiring`【8】會檢查。導覽列的「價格」由 `/#pricing` 改指 `/pricing`，
並新增「試穿」指向 `/playground`。

---

## CR-005 — 首頁 IA 重新編排

| 項目 | 內容 |
|---|---|
| 日期 | 2026-08-18 |
| 影響章節 | §4 |
| 原規格 | Hero → Goals → Work → Template → Advisor → Philosophy → Services → Pricing → Process → CTA |
| 變更為 | Hero → Goals → Work → **Services** → Template → Advisor → Philosophy → **Process → Pricing** → CTA |
| 裁決 | Luffy 裁決採用 |
| 版本 | V1.4 → V1.5 |

**動機**：`docs/gptsay.md` 對線上站的資訊架構評論——
「太忠實地把 Spec 每一項都畫成一個 Section」，結果首頁讀起來是一份
產品規格展示頁，而不是一間工作室的官網。三個具體的點：

```text
Template Experience 太巨大   它是首頁上體積最大的一塊，而且排在第 5 位。
                             體積問題要改程式（精簡版 + /playground），
                             位置問題這次先解決
服務被埋在第 8 位             「我們能做什麼」是工作室官網的核心論證，
                             卻排在 AI 哲學後面
價格在流程之前               先講多少錢再講怎麼做，順序反了
```

### 這次**沒有**採納的兩項（都要先寫程式）

```text
把 Goal Selector 移出首頁     它是四個區塊的 context controller，
                             而 setGoal 只有一個呼叫點就在它裡面。
                             移出去之前要先把那個動作接到別的地方，
                             否則整個目標情境只剩網址參數觸發得了
Template Experience 縮小 60%  需要一個精簡版區塊，加上 /playground
                             或 /templates 承接完整控制項。兩條路由都還不存在
```

### 為什麼改的是 §4 而不是只在後台排一次

BJ-2 的版面編輯器可以把順序存成 `cms_documents` 的一列。但那一列
**活不過 e2e**——`admin-layout.spec.ts` 的收尾測試會把版面排回預設並存檔，
而 e2e 打的是同一個資料庫。也就是說跑一次 `pnpm e2e` 就會把線上首頁重設。

所以「產品的預設編排」屬於程式碼與規格，資料庫那一列是給臨時調整用的。

---

## CR-003 — Widget 編輯器、擴充 Block、AI 客服體驗

| 項目 | 內容 |
|---|---|
| 日期 | 2026-08-13 |
| 影響章節 | §22、§23、§36、§40 |
| 原規格 | `❌ 完整 CMS 平台`、`❌ Wix-like Drag & Drop Editor`、`❌ Production AI Website SaaS`；免費／付費的線畫在「開始產生成果」 |
| 變更為 | 解禁可拖曳的 Widget 編輯與擴充 Block；模板內 AI 客服體驗 Widget 解禁；線改畫在「存檔」 |
| 裁決 | Luffy 裁決採用，定價選項 B |
| 版本 | V1.3 → V1.4 |

**動機（Luffy 原話）：** 「這些也能抄啊 還有 AI 部份 如果他們網站想接 AI 客服
也可以在模板給他們接個 AI 體驗一下 模板排版方式用 widget 可拖曳那種怎麼樣
每個區塊都是 widget」

### 界線（這條 CR 解禁到哪裡為止）

解禁：Widget 拖曳排序與設定、擴充 Section 種類、白名單嵌入、模板內的 AI 客服體驗。

**仍是非目標**：多站台管理、權限矩陣、內容工作流、Code Export、
以及真正部署給客戶的 AI 客服產品（知識庫、用量計費、對話後台）。

### 兩條隨此 CR 生效的硬性要求

1. **拖曳必須同時可鍵盤操作**（WCAG 2.1 §2.5.7）。每個 widget 除了拖曳握把，
   必須提供可 focus 的上移／下移控制項，且兩者呼叫同一個重排函式。
   這不是加分項——只能用滑鼠拖的編輯器會讓 §35 的 a11y 門檻直接失守。

2. **AI 客服體驗 Widget 不得持有任何工具。** 它回答的是被預覽那間店的事，
   不該碰得到我們的作品集、價格或 Lead。零工具是結構上的保證，
   不是提示詞裡的一句叮嚀。

---

## CR-001 — 物件儲存改用 Cloudflare R2

| 項目 | 內容 |
|---|---|
| 日期 | 2026-08-10 |
| 提出時機 | Phase 2C 開工前 |
| 影響章節 | §1、§8.9、§36 |
| 原規格 | Portfolio 媒體使用 Supabase Storage |
| 變更為 | 使用 Cloudflare R2（S3 相容） |
| 裁決 | 已裁決採用 |
| 版本 | V1.1 → V1.2 |

**主要後果：授權模型改變。**

Supabase Storage 與資料庫共用 RLS，policy 是宣告式的、寫在 migration 裡，
可被 `pnpm test:db` 驗證。R2 沒有 RLS——上傳授權只剩自家 server 把關。

因此 §8.9 新增明確禁令（前端不得持有 access key、presign endpoint 必須驗證身分、
bucket 不可公開列舉），§36 的 Upload 檢查清單同步調整。

**不受影響：** §39 資料庫結構、§8.5 媒體資料模型、路徑慣例
`portfolio/{projectId}/{uuid}.{ext}`。R2 換的是儲存後端，不是資料模型。

## CR-002 — 開放公開註冊 + 帳號內聯繫

| 項目 | 內容 |
|---|---|
| 日期 | 2026-08-11 |
| 提出時機 | Phase 3 收尾後、Phase 4 開工前 |
| 影響章節 | §37、§38、§40 |
| 原規格 | 訪客全程匿名；`❌ Client Portal` 列為非目標 |
| 變更為 | 開放公開註冊；會員可透過站內帳號與我們聯繫 |
| 裁決 | Luffy 裁決採用 |
| 版本 | V1.2 → V1.3 |

**動機（Luffy 原話）：** 「一樣開放給使用者註冊，這樣他們有問題透過這網站帳號跟我們聯繫。」

### 界線（這條 CR 解禁到哪裡為止）

解禁：帳號、登入、我的詢問、與我們的訊息往返、後台收件匣。

**仍是非目標**：專案進度追蹤、檔案交付區、線上報價審批、簽核流程、付款。

理由是這些一旦開始，V1 就從「接案網站」變成「專案管理系統」，
而 §40 存在的目的正是擋住這種漂移。

### 主要後果一：註冊攻擊面回到開放狀態

`GOTRUE_DISABLE_SIGNUP=true` 是 Phase 2 為了關掉公開註冊而設的。
關掉它等於任何人都能建立帳號。因此下列不是「之後再補」，是同一段的一部分：

- Email 驗證。沒有驗證，帳號可以用不存在的信箱大量產生，
  而且「透過帳號聯繫我們」這件事會失去意義——我們回覆的信箱是假的。
- 註冊與送出詢問的速率限制（參考 `ai_island_v3` 的 `src/lib/rate-limit.ts`）。
- 錯誤訊息不得洩漏帳號是否存在。
  （反例：`insight-engine` 的 `send-code` 對已註冊信箱回 409，等於帳號列舉。）

### 主要後果二：權限模型分兩層，而且刻意不合併

`admin_users` 維持為**獨立的員工白名單**，不改為 `profiles.role` 單一欄位。

`ai_island_v3` 用 `profiles.role` 同時表示 member 與 admin。
那表示「處理會員資料的程式碼」與「決定誰是管理員的程式碼」碰的是同一列。

本專案已有的 RLS policy 全部引用 `admin_users`。維持分離的結果是：
**這條 CR 不需要改動任何一條既有的 RLS policy**，
而且 profile 相關的 bug 在結構上不可能升級成管理員權限。

> 會員 = 有 `auth.users` 列、但不在 `admin_users` 裡的人。

### 主要後果三：與未來 SnowRealm SSO 的關係

平台規劃（`SnowRealmSpace/docs/SnowRealm-Platform-Planning.md`）要做跨子網域 SSO，
issuer 尚未拍板。1page 現在自己發證，將來要遷移。

降低遷移成本的三個決定（現在做，成本近乎為零；事後補很貴）：

1. 認證相關程式碼全部收在 `src/features/auth/` 一個目錄，頁面不直接呼叫 Supabase auth。
2. `profiles` 預留 `snowrealm_id`（可為 null）供將來對接。
   前例：`SnowRealmSpace/supabase/migrations/0051_snowrealm_id_link.sql`。
3. 業務資料表（詢問、訊息）外鍵指向 `profiles.id`，不指向 `auth.users.id`。
   換 issuer 時只需要重建 `profiles` 與 `auth.users` 的對應，業務資料不動。

⚠️ **SSO 會需要 `Domain=.snowrealm.pet` 的 cookie。**
那一刻起，媒體網域 `1page-r2.snowrealm.pet` 也會收到 auth cookie。
這在 CR-001 時只是假設，現在是已列入規劃的事。詳見待辦清單對應條目。
