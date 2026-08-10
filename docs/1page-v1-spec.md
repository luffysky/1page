# 一頁起家 Web Platform V1 Implementation Spec

**Project:** 一頁起家  
**Version:** V1.1  
**Stack:** Next.js + TypeScript + Tailwind CSS + Framer Motion + Supabase  
**定位:** AI-assisted Digital Studio / Interactive Sales Platform  
**狀態:** 🔒 **FROZEN — Source of Truth**

> 本文件已封版。實作期間不得為了遷就實作方便而修改本文件。
>
> 若實作中發現規格有誤或不可行，流程為：
> 記錄於 Implementation Plan 的「規格衝突」區 → 人工裁決 → 才發 V1.2。
>
> 不接受「邊做邊改 Spec」。

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
├── Auth
└── Storage

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
Goal Selector
↓
Selected Work / Portfolio
↓
Website / Template Experience   ← 獨立 Section，不得併入 Agent
↓
AI Website Advisor
↓
AI Philosophy
↓
Services
↓
Pricing
↓
Process
↓
Final CTA
↓
Footer
```

作品集應在首頁較前面出現，因為它是陌生客戶建立信任的重要證據。

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

使用 Supabase Storage。

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

Portfolio Upload：

- MIME allowlist
- file size limit
- extension validation
- SVG sanitize or disable raw inline rendering
- filename sanitize
- storage policy
- admin-only write permission

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
