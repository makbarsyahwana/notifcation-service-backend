# Birthday Reminder Service (NestJS + Bun)

Backend service that stores users and runs a worker that sends a **"Happy Birthday"** message at **09:00** in each user's local timezone on their birthday.

## Requirements

- **Runtime**: Bun
- **Backend**: NestJS
- **Database**: MongoDB

## Running with Docker

Start MongoDB + Redis + API + worker:

```bash
docker compose up --build
```

- API: `http://localhost:3000`
- MongoDB: `mongodb://localhost:27017`
- Redis: `redis://localhost:6379`

Environment variables used by containers:

- `APP_ENV` (set to `production` in docker-compose)
- `MONGODB_URI` (defaults to `mongodb://localhost:27017/birthday_reminder` for local runs)
- `PORT` (API only; defaults to `3000`)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (BullMQ)

Required for API auth:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

### Using your own env with Docker Compose

The Docker image does not bundle any `.env*`
If you want to use your own env values (JWT/SMTP/hCaptcha/etc.), pass them at runtime via Docker Compose.

The repository includes `.env.docker.example` for convenience.
If you want your own secrets, copy it to `.env.docker` and use an override file.

1) Create an env file, e.g. `.env.docker`, and put your values there:

```env
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# Optional: SMTP (for real email sending)
SMTP_ENABLED=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
MAIL_FROM="Birthday Reminder <no-reply@example.com>"

# Optional: hCaptcha (enable only if you have a secret key)
HCAPTCHA_ENABLED=false
HCAPTCHA_SECRET_KEY=your_hcaptcha_secret_key
HCAPTCHA_REQUIRED_AFTER_OTP_REQUESTS=3
HCAPTCHA_REQUIRED_AFTER_OTP_FAILS=5
HCAPTCHA_WINDOW_SECONDS=900

# Optional: worker dev flag
BIRTHDAY_INCLUDE_UNVERIFIED=false

# Optional: worker timing flags
# If BIRTHDAY_SEND_ANYTIME=true, the worker will send/log at 00:00 local time.
# Otherwise it will send/log only at BIRTHDAY_SEND_TIME_LOCAL (default 09:00).
BIRTHDAY_SEND_ANYTIME=false
BIRTHDAY_SEND_TIME_LOCAL=09:00
```

2) Create `docker-compose.override.yml`:

```yml
services:
  api:
    env_file:
      - .env.docker
  worker:
    env_file:
      - .env.docker

```

## BullMQ worker throughput

The birthday worker uses BullMQ to process scheduled birthday jobs. You can tune parallelism and throughput with:

- `BIRTHDAY_WORKER_CONCURRENCY` (default: `25`): how many jobs are processed in parallel.
- `BIRTHDAY_WORKER_RATE_MAX` (optional): max jobs per rate window. If unset/empty, no rate limit is applied.
- `BIRTHDAY_WORKER_RATE_DURATION_MS` (default: `1000`): rate window size in milliseconds.

If you use Mailtrap or any SMTP provider with strict limits, consider setting `BIRTHDAY_WORKER_RATE_MAX` to a small value (e.g. `1` to `5`).

## Performance & complexity (cron vs BullMQ)

Let:

- `N` = total users
- `B` = users whose birthday is today (average `B ≈ N/365`)

Cron polling (every minute):

- Runs `1440` times/day.
- Mongo work/day is roughly `1440 * O(log N + B)` (indexed query + processing results).
- Plain English: every minute you pay an indexed lookup cost (`log N`) to find today's birthday users, plus you still have to process the matches (`B` users). Doing that 1440 times/day repeats the same work many times.

BullMQ scheduling:

- Processes only due jobs: work/day is roughly `O(B)` (plus `O(log N)` queue ops on user create/update/delete).
- Avoids the `~1440x` “read amplification” from polling.

Cost perspective (high level):

- Cron polling often looks cheaper upfront (no Redis), but it creates steady database read load 24/7.
- BullMQ adds Redis cost (roughly `O(N)` scheduled jobs in memory) but reduces database work and makes costs scale more with real sends/updates.

Decision framing:

- If your main goal is cost-minimization at `<=1M` users, and you don’t otherwise need Redis, cron polling can be cheaper.
- If your goal is production-grade scheduling, predictable behavior, and future extensibility (more queues/jobs), BullMQ is the better architecture—even if Redis adds some cost.
- If you already use Redis for caching/sessions/other queues, BullMQ becomes close to cost-neutral while still delivering the performance and operational wins.

3) Run:

```bash
docker compose up --build
```

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

## SMTP email setup (Mailtrap)

This service sends OTP emails and (optionally) birthday emails via SMTP using Nodemailer.

Mailtrap options:

- **Mailtrap Email Testing**: emails are captured in a Mailtrap inbox (no real delivery). Good for development.
- **Mailtrap Email Sending**: real delivery, but you must use a verified sender/domain.

Demo domain limitation (Mailtrap Email Sending):

- If you see an error like:

```text
554 5.7.1 Demo domains can only be used to send emails to account owners.
```

it means you are using a Mailtrap **demo domain**, which can only send to the account owner address.
To send to any recipient:

- Use **Mailtrap Email Testing** (captures emails), or
- Set up **Mailtrap Email Sending** with your own verified domain/sender.

SMTP environment variables:

- `SMTP_ENABLED=true`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS`
- `MAIL_FROM`

## hCaptcha setup

hCaptcha is used as an anti-abuse measure for auth endpoints. It is **conditionally required** only after suspicious behavior / repeated attempts.

Backend (this service):

- Uses the **hCaptcha Secret Key** (server-side).
- Env vars:
  - `HCAPTCHA_ENABLED=true`
  - `HCAPTCHA_SECRET_KEY=<your_secret_key>`
  - `HCAPTCHA_REQUIRED_AFTER_OTP_REQUESTS` (default `3`)
  - `HCAPTCHA_REQUIRED_AFTER_OTP_FAILS` (default `5`)
  - `HCAPTCHA_WINDOW_SECONDS` (default `900`)

Frontend (if you build one later):

- Uses the **hCaptcha Site Key** (public) (often named like `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`).
- Do **not** put the secret key in the frontend.

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

- The worker uses **BullMQ** (Redis) to schedule one delayed job per user.
- On startup, it does a one-time scan to (re)schedule jobs for existing users.

Throughput controls:

- `BIRTHDAY_WORKER_CONCURRENCY` (default: `25`): how many jobs are processed in parallel.
- `BIRTHDAY_WORKER_RATE_MAX` (optional): max jobs per rate window. If unset/empty, no rate limit is applied.
- `BIRTHDAY_WORKER_RATE_DURATION_MS` (default: `1000`): rate window size in milliseconds.

Note: Mailtrap may need throttling. Consider setting `BIRTHDAY_WORKER_RATE_MAX` to a small value (e.g. `1` to `5`).

Timing controls:

- `BIRTHDAY_SEND_ANYTIME`:
  - If `true`, the worker will send/log at `00:00` in the user's local timezone.
  - If `false` (default), the worker will only send/log at `BIRTHDAY_SEND_TIME_LOCAL` in the user's local timezone.
- `BIRTHDAY_SEND_TIME_LOCAL`:
  - Local send time in **24-hour `HH:mm`** format (example: `09:00`, `10:30`).
  - Default is `09:00`.
  - If the value is invalid, it falls back to `09:00`.

Precedence:

- If `BIRTHDAY_SEND_ANYTIME=true`, `BIRTHDAY_SEND_TIME_LOCAL` is ignored.

```text
Happy Birthday, <name>! (<email>)
```

De-duplication:

- The worker records `lastBirthdayMessageDate` (local date `YYYY-MM-DD`) so it won't send twice in the same day.

Email verification:

- Birthday messages are only sent to users with `emailVerified=true`.

Development feature flag:

- Set `BIRTHDAY_INCLUDE_UNVERIFIED=true` to include unverified users in the worker scan.
- When enabled, unverified users will be **logged to console only** (no SMTP), while verified users keep the normal behavior.
- Default is `false`.

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
