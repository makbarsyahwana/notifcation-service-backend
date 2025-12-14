# Birthday Reminder Service (NestJS + Bun)

Backend service that stores users and runs a worker that sends a **"Happy Birthday"** message at **09:00** in each user's local timezone on their birthday.

## Requirements

- **Runtime**: Bun
- **Backend**: NestJS
- **Database**: MongoDB

## Running with Docker

Start MongoDB + API + worker:

```bash
docker compose up --build
```

- API: `http://localhost:3000`
- MongoDB: `mongodb://localhost:27017`

Environment variables used by containers:

- `APP_ENV` (set to `production` in docker-compose)
- `MONGODB_URI` (defaults to `mongodb://localhost:27017/birthday_reminder` for local runs)
- `PORT` (API only; defaults to `3000`)

## Environment management (local/dev/staging/production)

The app supports loading environment files based on `APP_ENV`:

- If `APP_ENV=local` it will load `.env.local` (if present)
- If `APP_ENV=dev` it will load `.env.dev` (if present)
- If `APP_ENV=staging` it will load `.env.staging` (if present)
- If `APP_ENV=production` it will load `.env.production` (if present)

It will also load `.env` as a fallback if it exists.

All real `.env*` files are gitignored. Only `*.example` templates are committed.

Recommended workflow:

```bash
cp .env.local.example .env.local
cp .env.dev.example .env.dev
cp .env.staging.example .env.staging
cp .env.production.example .env.production
```

Then export `APP_ENV` before running:

```bash
APP_ENV=local bun run start:dev
APP_ENV=local bun run start:worker:dev
```

## Auth (OTP + JWT)

This service uses passwordless **OTP via email** to log in.

Endpoints:

- `POST /auth/signup` (creates user and triggers OTP email)
- `POST /auth/request-otp` (request a login OTP)
- `POST /auth/verify-otp` (verify OTP and receive tokens)
- `POST /auth/refresh` (rotate refresh token and receive new tokens)

Example signup:

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H 'content-type: application/json' \
  -d '{"name":"Jane Doe","email":"jane@example.com","birthday":"1990-12-14","timezone":"Asia/Jakarta"}'
```

Example request OTP:

```bash
curl -X POST http://localhost:3000/auth/request-otp \
  -H 'content-type: application/json' \
  -d '{"email":"jane@example.com"}'
```

Example verify OTP:

```bash
curl -X POST http://localhost:3000/auth/verify-otp \
  -H 'content-type: application/json' \
  -d '{"email":"jane@example.com","otp":"123456"}'
```

Response:

```json
{
  "accessToken": "...",
  "refreshToken": "..."
}
```

Example refresh:

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H 'content-type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

For staging/production, set `MONGODB_URI` to a credentialed MongoDB connection string.

## Running locally (without Docker)

```bash
bun install

# API (watch)
bun run start:dev

# Worker (watch)
bun run start:worker:dev
```

## API

### Create user

Note: `POST /users` is a direct user creation endpoint.
In typical usage you should prefer `POST /auth/signup` (OTP login + verification).

`POST /users`

Body:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "birthday": "1990-12-14",
  "timezone": "Asia/Jakarta"
}
```

Example:

```bash
curl -X POST http://localhost:3000/users \
  -H 'content-type: application/json' \
  -d '{"name":"Jane Doe","email":"jane@example.com","birthday":"1990-12-14","timezone":"Asia/Jakarta"}'
```

Validation:

- `email` must be a valid email and unique
- `birthday` must be an ISO date in `YYYY-MM-DD` format
- `timezone` must be a valid IANA timezone (e.g. `America/New_York`)

### Get user by id

`GET /users/:id`

This endpoint is protected by JWT and only allows a user to access their own record.

```bash
curl http://localhost:3000/users/<mongoObjectId> \
  -H 'authorization: Bearer <accessToken>'
```

### Update user

`PATCH /users/:id`

```bash
curl -X PATCH http://localhost:3000/users/<mongoObjectId> \
  -H 'authorization: Bearer <accessToken>' \
  -H 'content-type: application/json' \
  -d '{"timezone":"America/New_York"}'
```

### Delete user

`DELETE /users/:id`

```bash
curl -X DELETE http://localhost:3000/users/<mongoObjectId>
  -H 'authorization: Bearer <accessToken>'
```

## Worker behavior

- The worker runs every minute.
- For each user it checks the **current local time** in `user.timezone`.
- If it's **09:00** local time and **today's month/day matches** the user's birthday, it logs:

```text
Happy Birthday, <name>! (<email>)
```

De-duplication:

- The worker records `lastBirthdayMessageDate` (local date `YYYY-MM-DD`) so it won't send twice in the same day.

Email verification:

- Birthday messages are only sent to users with `emailVerified=true`.

Email sending (optional):

- If `SMTP_ENABLED=true` and SMTP config is provided, the worker will send an email via SMTP (Nodemailer).
- If SMTP is not configured, it falls back to console logging.

Free options for testing SMTP:

- Mailtrap (captures emails in a sandbox inbox)
- Ethereal Email (test SMTP account; not real delivery)

## Tests

```bash
bun run test
```

## Notes / assumptions / limitations

- Email sending is **optional** and controlled by SMTP env configuration.
- Birthdays are stored as `YYYY-MM-DD` and matched by month/day.
- For `02-29` birthdays, the message will only be sent in leap years.
