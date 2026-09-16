# TMTR20 Frontend Integration Context

Use this document as context when building or connecting the frontend dashboard.

## Live backend

- Base URL: `https://tmtr20-web-tracker.onrender.com`
- Health check: `GET https://tmtr20-web-tracker.onrender.com/health`
- Tracker script: `https://tmtr20-web-tracker.onrender.com/tracker.js`
- Public tracking endpoint: `https://tmtr20-web-tracker.onrender.com/api/track`

The backend is an Express/TypeScript API backed by MongoDB. It is already deployed on Render.

## Important separation

There are two frontend concerns:

1. Visitor tracking is public. It uses the tracker script and a website-specific `trackingId`.
2. The dashboard is private. It uses JWT access tokens returned by the authentication API.

Never put MongoDB credentials, SMTP credentials, JWT secrets, or other backend environment secrets in browser code.

## Installing tracking on a customer website

The frontend must use the real `trackingId` returned when an authenticated user creates a website. Do not invent a tracking ID.

```html
<script
  src="https://tmtr20-web-tracker.onrender.com/tracker.js"
  data-site-id="tmtr_<TRACKING_ID_FROM_API>"
  defer>
</script>
```

The script automatically records `session_start` and `page_view`, detects SPA navigation, and tracks WhatsApp, phone, email, form, and CTA interactions. It does not collect form values or passwords.

For debugging, add `?tmtr20_debug=true` to the page URL. Tracking requests should return HTTP `202`.

## React or Next.js installation

For a React app, place the script in the document head or load it once from the root layout. For Next.js App Router, use `next/script` in `app/layout.tsx`:

```tsx
import Script from 'next/script';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const trackingId = process.env.NEXT_PUBLIC_TMTR20_TRACKING_ID;

  return (
    <html lang="en">
      <body>
        {children}
        {trackingId ? (
          <Script
            src="https://tmtr20-web-tracker.onrender.com/tracker.js"
            data-site-id={trackingId}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
```

Only `NEXT_PUBLIC_TMTR20_TRACKING_ID` is suitable for browser exposure. Use a separate value per tracked website.

## API client configuration

Use this frontend-only value:

```text
NEXT_PUBLIC_API_BASE_URL=https://tmtr20-web-tracker.onrender.com
```

Authenticated requests send the access token as:

```text
Authorization: Bearer <accessToken>
```

Example:

```ts
const response = await fetch(
  `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/websites`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  },
);
```

## Authentication endpoints

- `POST /api/auth/register` body: `{ name, email, password }`
- `POST /api/auth/login` body: `{ email, password }`
- `POST /api/auth/refresh` body: refresh-token payload required by the backend
- `POST /api/auth/logout` body: refresh-token payload required by the backend
- `GET /api/auth/me` requires the access token

Login returns an access token and refresh token. Keep tokens out of URLs. The frontend should handle expired access tokens by refreshing them, then retrying the original request once.

## Website endpoints

All website endpoints require the access token:

- `POST /api/websites` create a website; the server generates its `trackingId`
- `GET /api/websites` list the current user's websites
- `GET /api/websites/:id` get one owned website
- `PATCH /api/websites/:id` update one owned website
- `DELETE /api/websites/:id` archive one owned website

The create request includes a name, URL, and timezone. Example body:

```json
{
  "name": "TMTR20 Demo",
  "url": "https://example.com",
  "timezone": "Africa/Johannesburg"
}
```

After creation, use the returned website `trackingId` in the tracking script installed on that website.

## Analytics endpoints

All require the access token and `startDate`/`endDate` query parameters:

- `GET /api/websites/:id/overview`
- `GET /api/websites/:id/traffic`
- `GET /api/websites/:id/conversions`
- `GET /api/websites/:id/sources`
- `GET /api/websites/:id/top-pages`

Example:

```text
GET /api/websites/<website-id>/overview?startDate=2026-09-01&endDate=2026-09-30
```

## Audit and report endpoints

All require the access token and ownership of the website:

- `POST /api/websites/:id/audits`
- `GET /api/websites/:id/audits`
- `GET /api/websites/:id/audits/latest`
- `POST /api/websites/:id/reports/monthly`
- `GET /api/websites/:id/reports`
- `GET /api/websites/:id/reports/latest`
- `GET /api/websites/:id/reports/:reportId/pdf`
- `POST /api/websites/:id/reports/:reportId/email`

## Dashboard origin versus tracked website origins

This backend supports multiple websites. The dashboard has its own frontend origin, while every customer website being tracked has its own website URL and its own server-generated `trackingId`.

`CORS_ORIGIN` controls browser requests from dashboard frontend origins to the authenticated API. It does not need to contain every customer website URL because the public tracking route already permits cross-origin tracking requests.

For one dashboard deployment, set `CORS_ORIGIN` to that dashboard's origin:

```text
CORS_ORIGIN=https://your-frontend.vercel.app
```

For multiple dashboard environments or dashboard applications, use comma-separated origins:

```text
CORS_ORIGIN=https://app.example.com,https://staging.example.com,http://localhost:3000
```

If the dashboard must be hosted from arbitrary origins, use `CORS_ORIGIN=*`. Do not expose backend secrets through `NEXT_PUBLIC_*` variables.

Each tracked customer site installs the same script with its own tracking ID:

```html
<!-- customer-site-a.example uses its own ID -->
<script
  src="https://tmtr20-web-tracker.onrender.com/tracker.js"
  data-site-id="tmtr_<site-a-tracking-id>"
  defer>
</script>

<!-- customer-site-b.example uses a different ID -->
<script
  src="https://tmtr20-web-tracker.onrender.com/tracker.js"
  data-site-id="tmtr_<site-b-tracking-id>"
  defer>
</script>
```

Create each website through `POST /api/websites` while authenticated. The backend associates each website with the current user and generates the tracking ID. Never reuse one tracking ID across different websites.

## Task for the frontend coding assistant

Build the actual dashboard UI around this API. Start with login/register, website management, tracking ID installation instructions, analytics overview, date filtering, audits, and monthly reports. Centralize API requests in one client, handle loading/error/empty states, protect dashboard routes, and keep access tokens out of URLs. Use the live base URL above and do not mock API responses unless explicitly requested.