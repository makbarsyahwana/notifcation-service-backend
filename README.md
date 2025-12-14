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

Then export `APP_ENV` (or set it in the env file) before running:

```bash
APP_ENV=local bun run start:dev
APP_ENV=local bun run start:worker:dev
```

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

```bash
curl http://localhost:3000/users/<mongoObjectId>
```

### Update user

`PATCH /users/:id`

```bash
curl -X PATCH http://localhost:3000/users/<mongoObjectId> \
  -H 'content-type: application/json' \
  -d '{"timezone":"America/New_York"}'
```

### Delete user

`DELETE /users/:id`

```bash
curl -X DELETE http://localhost:3000/users/<mongoObjectId>
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

## Tests

```bash
bun run test
```

## Notes / assumptions / limitations

- Messages are **simulated via console log** (no email provider configured).
- Birthdays are stored as `YYYY-MM-DD` and matched by month/day.
- For `02-29` birthdays, the message will only be sent in leap years.
