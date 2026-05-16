# Pet Square API Design (Website + Admin)

Base URL: `/api`

## 1) Standards

### 1.1 Versioning
- Current: unversioned (`/api/...`)
- Recommended: move to `/api/v1/...` when you introduce breaking changes.

### 1.2 Auth
- Customer JWT: `Authorization: Bearer <token>` for customer-protected routes.
- Admin JWT: `Authorization: Bearer <token>` for admin routes.

### 1.3 Response shape (recommended)
- Success:
```json
{ "ok": true, "data": {} }
```
- Error:
```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

### 1.4 Pagination (recommended for list routes)
Query params:
- `page` (default 1)
- `limit` (default 20, max 100)
- `sort` (e.g. `-createdAt`)

Paginated response:
```json
{
  "ok": true,
  "data": {
    "items": [],
    "page": 1,
    "limit": 20,
    "total": 120,
    "totalPages": 6
  }
}
```

---

## 2) Website API (Storefront)

### Auth
- `POST /api/auth/register`
  - body: `{ name, email, password }`
  - returns: `{ token, user }`
- `POST /api/auth/login`
  - body: `{ email, password }`
  - returns: `{ token, user }`

### Catalog
- `GET /api/categories`
  - active categories only
- `GET /api/products?category=<slug>&search=<text>`
  - active products
- `GET /api/products/:slug`
  - product detail
- `GET /api/banners?position=<home-hero|home-mid|shop-top>`
  - active + date-valid banners

### Marketing
- `POST /api/subscribe`
  - body: `{ email }`

### Discounts
- `POST /api/discounts/validate`
  - body: `{ code, subtotal }`
  - returns: discount calculation result

### Orders (Customer)
- `POST /api/orders` (customer auth)
  - body: `{ items, shippingAddress, discountCode?, note? }`
- `GET /api/me/orders` (customer auth)
  - customer order history

### Recommended additions for website
- `GET /api/me`
- `PATCH /api/me`
- `GET /api/me/order/:id`
- `POST /api/auth/logout` (if you add token blacklist/session model)

---

## 3) Admin API

Prefix: `/api/admin`

### Admin Auth
- `POST /api/admin/login`
  - body: `{ username|email, password }`
  - returns: `{ token, admin }`

### Dashboard
- `GET /api/admin/dashboard`
  - metrics: products, categories, users, orders, subscribers, discounts, banners, revenue

### Users
- `GET /api/admin/users`
- `GET /api/admin/users/:id`
- `PATCH /api/admin/users/:id/status`
  - body: `{ status: "active" | "blocked" }`

### Subscribers
- `GET /api/admin/subscribers`

### Categories (CRUD)
- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`

### Products (CRUD)
- `GET /api/admin/products`
- `POST /api/admin/products`
- `PUT /api/admin/products/:id`
- `DELETE /api/admin/products/:id`

### Orders (Management)
- `GET /api/admin/orders`
- `GET /api/admin/orders/:id`
- `PATCH /api/admin/orders/:id`
  - body: `{ status?, paymentStatus? }`

### Discounts (CRUD)
- `GET /api/admin/discounts`
- `POST /api/admin/discounts`
- `PUT /api/admin/discounts/:id`
- `DELETE /api/admin/discounts/:id`

### Banners (CRUD)
- `GET /api/admin/banners`
- `POST /api/admin/banners`
- `PUT /api/admin/banners/:id`
- `DELETE /api/admin/banners/:id`

### Recommended additions for admin
- Add pagination/filters/sort for all list endpoints.
- Add soft delete support where business-safe.
- Add admin activity/audit logs.
- Add CSV export endpoints:
  - `GET /api/admin/orders/export`
  - `GET /api/admin/subscribers/export`

---

## 4) Data Contracts (Core)

### Product
- `_id`, `name`, `slug`, `sku`, `description`, `imageUrl`, `gallery[]`, `price`, `compareAtPrice`, `stock`, `isActive`, `category`, `createdAt`, `updatedAt`

### Category
- `_id`, `name`, `slug`, `description`, `imageUrl`, `isActive`, `createdAt`, `updatedAt`

### DiscountCode
- `_id`, `code`, `type(percent|fixed)`, `value`, `minOrderAmount`, `maxDiscountAmount`, `usageLimit`, `usedCount`, `isActive`, `startsAt`, `endsAt`, `createdAt`, `updatedAt`

### Banner
- `_id`, `title`, `subtitle`, `imageUrl`, `ctaText`, `ctaLink`, `position`, `priority`, `isActive`, `startsAt`, `endsAt`, `createdAt`, `updatedAt`

### Order
- `_id`, `orderNo`, `user`, `status`, `paymentMethod`, `paymentStatus`, `items[]`, `subtotal`, `shippingFee`, `tax`, `discountCode`, `discountAmount`, `total`, `shippingAddress`, `note`, `createdAt`, `updatedAt`

### User
- `_id`, `name`, `email`, `phone`, `role`, `status`, `address`, `createdAt`, `updatedAt`

---

## 5) Validation & Error Rules

### Validation
- Validate all IDs and enums.
- Normalize email + discount code case.
- Reject negative pricing/stock/amounts.

### Common HTTP codes
- `200` OK
- `201` Created
- `400` Validation/business rule
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `422` Semantically invalid request (optional)
- `500` Server error

---

## 6) Security & Ops

- Add rate limits:
  - auth/login, subscribe, discount validation
- Add CORS allow-list for production domains.
- Add structured request logs + error IDs.
- Add API docs UI (Swagger) if needed.

---

## 7) Implementation Status in Current Codebase

Implemented now:
- Most storefront and admin routes listed above are already present in `server/src/routes/public.js` and `server/src/routes/admin.js`.

Not yet standardized:
- unified response envelope
- pagination/filter params on admin lists
- audit logs/export endpoints
- `/api/me` profile endpoints

