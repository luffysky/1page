# 一頁起家 Web Platform V1 Implementation Spec

**Project:** 一頁起家  
**Version:** V1  
**Stack:** Next.js + TypeScript + Tailwind CSS + Framer Motion + Supabase  
**定位:** AI-assisted Digital Studio / Interactive Sales Platform

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

目前 HTML V2 只作功能概念參考，不沿用視覺設計。

正式版重新設計。

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
Website / Template Experience
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

點擊後：

- 更新推薦服務
- 更新推薦作品
- 或打開 Agent 並帶入 intent

例如：

```ts
openAgent({
  initialIntent: "website"
})
```

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
Homepage Visual
Responsive
```

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
