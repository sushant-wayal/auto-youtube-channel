# Motioncraft landing page

A standalone demand-validation site built with Next.js, TypeScript, Tailwind CSS, Framer Motion, Prisma, and PostgreSQL.

## Local setup

1. Copy `.env.example` to `.env`.
2. Add your PostgreSQL connection string as `DATABASE_URL`.
3. Set strong values for `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`.
4. Run:

```bash
npm install
npm run db:push
npm run dev
```

Open `http://localhost:3000` for the landing page and `http://localhost:3000/admin` for the protected research dashboard.

## Production

Set the same three environment variables in your hosting provider. Run `npm run db:push` against the production database once before accepting submissions, then deploy the Next.js app normally.

The public API routes validate submissions server-side. Email addresses are unique in the waitlist table, and the admin session is stored in an HTTP-only, same-site cookie.
