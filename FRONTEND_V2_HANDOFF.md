# TMTR20 Frontend V2 Handoff

This document describes the frontend that should be built against the current TMTR20 backend. The backend is already a working Express/MongoDB service with public browser tracking and authenticated website intelligence APIs.

## 1. Product Shape

Build an authenticated dashboard for website owners. The frontend should help a user move through:

```text
Overview
  -> Acquisition
  -> Audience
  -> Behaviour
  -> Conversions
  -> Website Health
  -> Intelligence
  -> Reports
```

The frontend should visualize measured data and make the evidence behind every conclusion visible. Do not invent metrics or present deterministic rules as causal explanations.

The backend does not contain the frontend application. Use this document as the integration contract.

## 2. Base Configuration

Configure one public browser-safe API variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://tmtr20-web-tracker.onrender.com
```

Do not expose:

- `MONGODB_URI`
- JWT signing secrets
- SMTP credentials
- Render credentials
- Any backend environment variable other than the public API base URL

The frontend application can be hosted separately, for example on Vercel or another static/Node host.

## 3. Authentication Flow

### Register

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "name": "Test User",
  "email": "user@example.com",
  "password": "a-strong-password"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "a-strong-password"
}
```

The response contains an access token and refresh token. Store access tokens in memory where practical. If refresh tokens are stored in browser storage, understand the XSS tradeoff; do not place tokens in URLs.

Authenticated requests use:

```http
Authorization: Bearer <accessToken>
```

### Refresh

```http
POST /api/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "<refresh-token>"
}
```

The backend rotates refresh tokens. Replace the old refresh token with the new one returned by the response.

### Logout

```http
POST /api/auth/logout
Content-Type: application/json
Authorization: Bearer <accessToken>
```

```json
{
  "refreshToken": "<refresh-token>"
}
```

### Current user

```http
GET /api/auth/me
Authorization: Bearer <accessToken>
```

### Frontend auth states

Implement these states explicitly:

- Loading session
- Unauthenticated
- Authenticated
- Access token expired and refreshing
- Refresh failed and signed out
- Forbidden/ownership failure
- Network unavailable

Use one API client/interceptor so token refresh and error handling are consistent across every page.

## 4. API Response Envelope

Successful responses generally follow:

```json
{
  "success": true,
  "data": {},
  "message": "..."
}
```

Errors generally follow the centralized backend error shape. The frontend should render a useful message, preserve the machine-readable error code, and avoid showing stack traces.

Create shared TypeScript types for:

- `ApiResponse<T>`
- `ApiError`
- `Period`
- `Website`
- `Audit`
- `Report`
- Analytics responses
- `Insight`

## 5. Website Management

### List websites

```http
GET /api/websites
Authorization: Bearer <accessToken>
```

### Create website

```http
POST /api/websites
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "TMTR20 Demo",
  "url": "https://www.example.com",
  "timezone": "Africa/Johannesburg"
}
```

The backend generates the tracking ID. The frontend must display the returned `trackingId` and provide an installation snippet using that exact value.

### Get, update, archive

```http
GET    /api/websites/:id
PATCH  /api/websites/:id
DELETE /api/websites/:id
```

Website statuses are `ACTIVE`, `PAUSED`, and `ARCHIVED`.

Recommended frontend behavior:

- Do not show archived websites in the default selector.
- Make the active website selector global to the dashboard.
- Persist the selected website ID in the URL or frontend state.
- Clear or replace selected website state when the website is archived.
- Every analytics request must use the selected website ID.

## 6. Tracker Installation Screen

Build a setup screen that shows:

```html
<script
  src="https://tmtr20-web-tracker.onrender.com/tracker.js"
  data-site-id="tmtr_<tracking-id>"
  defer>
</script>
```

Also show:

- Tracker URL
- Tracking ID
- Installation status instructions
- Debug URL example: `https://customer-site.com/?tmtr20_debug=true`
- A copy button
- A verification action or checklist

The tracker is public. The tracking ID identifies the website but is not a dashboard credential.

## 7. Shared Date-Range Model

All analytics endpoints require:

```text
startDate=YYYY-MM-DD
endDate=YYYY-MM-DD
```

Example:

```text
/api/websites/:id/overview?startDate=2026-09-01&endDate=2026-09-30
```

The backend interprets a date-only end date as inclusive by extending it to the next UTC day. The frontend should send date-only values and display the selected range consistently.

Recommended controls:

- Today
- Yesterday
- Last 7 days
- Last 30 days
- This month
- Previous month
- Custom range

Every page should display:

- Selected website
- Selected period
- Loading state
- Empty state
- Error state
- Last refreshed state

## 8. Overview Page

### Endpoint

```http
GET /api/websites/:id/overview?startDate=...&endDate=...
```

### Response data

```json
{
  "period": {
    "startDate": "2026-09-01T00:00:00.000Z",
    "endDate": "2026-10-01T00:00:00.000Z"
  },
  "visitors": 980,
  "sessions": 1200,
  "pageViews": 3100,
  "pagesPerSession": 2.58,
  "averageSessionDurationSeconds": 142,
  "conversions": 42,
  "conversionRate": 3.17,
  "conversionBreakdown": {
    "whatsapp_click": 10,
    "phone_click": 5,
    "email_click": 4,
    "form_submission": 15,
    "cta_click": 8
  }
}
```

Build:

- KPI strip
- Traffic summary
- Page-view/session trend
- Conversion summary
- Conversion breakdown
- Link to the intelligence page

Do not label `averageSessionDurationSeconds` as active engagement time. Active engagement is provided separately by behavior/intelligence data.

## 9. Acquisition Page

### Endpoint

```http
GET /api/websites/:id/sources?startDate=...&endDate=...
```

### Source row

```json
{
  "source": "google",
  "medium": "cpc",
  "campaign": "spring",
  "content": "hero",
  "term": "analytics",
  "referralDomain": "www.google.com",
  "sourceCategory": "Paid Search",
  "sessions": 220,
  "visitors": 180
}
```

Build:

- Source category summary
- Source/medium table
- Campaign table
- Referral domain table
- Landing-page links into intelligence
- Empty direct-traffic state

Do not infer revenue or ROI. The backend currently has no revenue field.

## 10. Audience Page

### Endpoint

```http
GET /api/websites/:id/audience?startDate=...&endDate=...
```

### Response sections

```json
{
  "devices": [{ "value": "mobile", "sessions": 700, "visitors": 590 }],
  "operatingSystems": [{ "value": "Android", "sessions": 400, "visitors": 350 }],
  "languages": [{ "value": "en-ZA", "sessions": 800, "visitors": 700 }],
  "timezones": [{ "value": "Africa/Johannesburg", "sessions": 650, "visitors": 560 }],
  "viewports": [{ "value": "small", "sessions": 600, "visitors": 500 }],
  "screens": [{ "value": "large", "sessions": 500, "visitors": 430 }]
}
```

Build:

- Device distribution
- Operating-system distribution
- Browser view from existing event/browser data if needed
- Language and timezone tables
- Viewport/screen category charts

Display a privacy note explaining that values are coarse browser hints, not identity or demographics. Never label these values as age, income, gender, or location demographics.

## 11. Behaviour Page

### Endpoint

```http
GET /api/websites/:id/behavior?startDate=...&endDate=...
```

### Response sections

- `scrollDepth`: page and threshold reach
- `engagement`: active-time summary
- `outboundClicks`: destination totals
- `forms`: form starts, submissions, and abandonment events
- `interactionProblems`: rage/dead clicks by page
- `clicks`: normalized heatmap cells

Example:

```json
{
  "engagement": {
    "averageActiveMs": 28400,
    "sessions": 1200,
    "averageMaxScrollDepthPercent": 61.4
  },
  "clicks": [
    {
      "pagePath": "/pricing",
      "x": 4200,
      "y": 3100,
      "clicks": 18
    }
  ]
}
```

Build tabs or sections:

- Engagement
- Scroll depth
- Outbound links
- Forms
- Interaction problems
- Heatmap

Heatmap requirements:

- Render clicks as cells over the selected page representation.
- Explain that `x` and `y` are 1% buckets represented as basis points from `0` to `10000`.
- Do not imply screenshots or session replay exist.
- Filter heatmap by `pagePath`.
- Show an empty state when no clicks exist for the selected page.

## 12. Conversion Page

### Endpoint

```http
GET /api/websites/:id/conversions?startDate=...&endDate=...
```

The response includes:

- `conversionEvents`
- `convertingSessions`
- `sessions`
- `conversionRate`
- `breakdown`
- `byPage`
- `bySource`
- `byDevice`

Headline conversion rate is based on unique converting sessions, not raw event count.

### Funnel management

```http
GET    /api/websites/:id/funnels
POST   /api/websites/:id/funnels
PATCH  /api/websites/:id/funnels/:funnelKey
DELETE /api/websites/:id/funnels/:funnelKey
```

Funnel definition:

```json
{
  "key": "lead-generation",
  "name": "Lead generation",
  "active": true,
  "steps": [
    {
      "key": "landing",
      "name": "Landing page",
      "eventName": "page_view",
      "pagePath": "/services"
    },
    {
      "key": "submit",
      "name": "Form submitted",
      "eventName": "form_submission",
      "pagePath": "/contact"
    }
  ]
}
```

Rules:

- Maximum 10 funnels per website
- Between 2 and 5 steps
- Unique keys
- `pagePath` and `pagePathPrefix` cannot both be used
- Final step must be a conversion event

Evaluate a funnel:

```text
GET /api/websites/:id/conversions?funnel=lead-generation&startDate=...&endDate=...
```

Build:

- Conversion KPI cards
- Conversion type chart
- Page/source/device tables
- Funnel editor
- Funnel step visualization
- Funnel drop-off visualization
- Empty/low-sample states

## 13. Cross-Dimension Intelligence Page

### Endpoint

```http
GET /api/websites/:id/intelligence?startDate=...&endDate=...
```

The response contains:

```json
{
  "period": {},
  "comparison": {
    "startDate": "...",
    "endDate": "...",
    "available": true
  },
  "totals": {},
  "rows": [],
  "exitPages": [],
  "insights": {
    "opportunities": [],
    "problems": [],
    "trends": [],
    "anomalies": [],
    "recommendations": []
  }
}
```

Rows connect:

```text
source category
source
medium
campaign
landing page
device
sessions
visitors
conversions
converting sessions
conversion rate
engagement time
scroll depth
pages per session
```

Build filters for:

- Source category
- Source
- Medium
- Campaign
- Landing page
- Device

Build comparison cards for:

- Sessions
- Visitors
- Conversion rate
- Engagement time
- Scroll depth

Each insight has a stable ID, severity, title, message, scope, evidence, and recommendation ID. Render the structured evidence, not only the prose message.

Important semantics:

- Insights are deterministic rules, not AI conclusions.
- Insights are evidence-based but not causal explanations.
- Small cohorts are intentionally excluded from dimension-level conclusions.
- `exitPages` means recorded latest page, not confirmed browser exit.

Recommended UI:

- Opportunity list
- Problem list
- Trend list
- Anomaly list
- Recommendation list
- “Why am I seeing this?” evidence drawer
- Links from an insight to the matching acquisition, behavior, conversion, or page view

## 14. Intelligence Rules

The backend currently uses minimum sample thresholds and stable rule IDs. Frontend code should switch on IDs, not parse text.

Potential IDs include:

```text
OPP_HIGH_ENGAGEMENT_LOW_CONVERSION
OPP_TRAFFIC_NO_CONVERSIONS
PROBLEM_LOW_SCROLL
TREND_TRAFFIC_CHANGE
TREND_CONVERSION_CHANGE
REVIEW_TRAFFIC_SOURCES
REVIEW_CONVERSION_PATH
REVIEW_CTA_AND_FORM
REVIEW_PAGE_STRUCTURE
WAIT_FOR_MORE_DATA
VERIFY_TRACKING_AND_CONVERSION_SETUP
```

Unknown future IDs must render through a generic fallback card instead of breaking the page.

## 15. Website Health Page

### Run audit

```http
POST /api/websites/:id/audits
Authorization: Bearer <accessToken>
```

### List/latest

```http
GET /api/websites/:id/audits
GET /api/websites/:id/audits/latest
```

Audit data includes aggregate scores:

- Performance
- SEO
- Accessibility
- Mobile
- Security

It may include detailed server-observed information about:

- Response metadata
- SEO tags
- Canonical/lang/Open Graph/structured data
- Image alt attributes
- Form labels and landmarks
- Security headers
- Mixed content
- Same-origin resource status

Do not label it as Lighthouse or a complete accessibility/security audit. Browser-only metrics and runtime JavaScript errors are unavailable.

Build:

- Score overview
- Issue list grouped by category
- Recommendation list
- Resource failure list
- Audit history
- Latest-versus-previous comparison
- Run-audit action with progress state
- Rate-limit error state

## 16. Reports Page

### Endpoints

```http
POST /api/websites/:id/reports/monthly
GET  /api/websites/:id/reports
GET  /api/websites/:id/reports/latest
GET  /api/websites/:id/reports/:reportId/pdf
POST /api/websites/:id/reports/:reportId/email
```

Build:

- Report period selector
- Generate report action
- Report history
- Latest report summary
- PDF download
- Email report form
- Sending/generation states
- Failed report state

The backend currently generates PDFs on local storage. Treat PDF download failures as possible operational failures after redeployments.

## 17. Recommended Frontend Routes

```text
/login
/register
/app
/app/websites
/app/websites/:websiteId/overview
/app/websites/:websiteId/acquisition
/app/websites/:websiteId/audience
/app/websites/:websiteId/behavior
/app/websites/:websiteId/conversions
/app/websites/:websiteId/intelligence
/app/websites/:websiteId/health
/app/websites/:websiteId/reports
/app/websites/:websiteId/settings/tracking
/app/websites/:websiteId/settings/funnels
```

Use nested layout data loading so the selected website and date range are shared. Keep page-level queries separate so one failed analytics section does not blank the entire dashboard.

## 18. Query and State Architecture

Recommended frontend modules:

```text
api/
  client.ts
  auth.api.ts
  websites.api.ts
  analytics.api.ts
  audits.api.ts
  reports.api.ts
  funnels.api.ts

features/
  auth/
  websites/
  overview/
  acquisition/
  audience/
  behavior/
  conversions/
  intelligence/
  audits/
  reports/

components/
  DateRangePicker
  WebsiteSelector
  QueryState
  EmptyState
  ErrorState
  KpiCard
  DataTable
  InsightCard
```

Use query keys containing:

```text
websiteId
startDate
endDate
endpoint-specific filters
```

Invalidate or refetch after:

- Website creation/update/archive
- Funnel create/update/delete
- Audit run
- Report generation

Do not poll public tracking events aggressively. The backend is not a real-time streaming API.

## 19. Loading, Empty, and Error Design

Every data view must support:

- Initial loading skeleton
- Refetching indicator
- Empty dataset explanation
- Invalid date range
- Website not found
- Unauthorized/expired session
- Rate limited
- MongoDB/service unavailable
- Partial section failure

Useful empty-state copy:

- “No tracking events have been received for this period.”
- “More data is needed before this insight can be calculated.”
- “No conversions were recorded for this selection.”
- “No heatmap clicks are available for this page.”

Do not display zero as if it means a verified absence when the backend reports unavailable data.

## 20. Privacy and Product Boundaries

The frontend must not:

- Display visitor IDs as user identities
- Display session IDs
- Claim age, gender, income, or sensitive demographics
- Claim causal explanations from deterministic insights
- Present server audit scores as complete security/accessibility certification
- Display form values or passwords
- Build session replay from the current API

The current tracker stores anonymous IDs and coarse audience hints. Add consent-management UI before expanding tracking to jurisdictions or customers that require it.

## 21. Final Integration Checklist

Before release, verify:

- Login, refresh, and logout work.
- Website selector changes every page query.
- Every analytics request includes a valid date range.
- All protected calls send the bearer token.
- Expired tokens refresh once and retry safely.
- Tracker installation uses the server-generated tracking ID.
- Cross-origin tracker loading works.
- New events appear in behavior and conversion analytics.
- Funnel edits are validated and ownership-protected.
- Intelligence evidence links to the correct filtered view.
- Audit limitations are visible in the UI.
- PDF download and email failures are handled.
- Mobile layout supports dense tables and charts.
- Unknown insight IDs do not break rendering.
- No backend secrets are included in the browser bundle.
