# Pub Quiz Trainer

A mobile-optimized web app for training your crew for pub quizzes.

## Features

- **Player Login** — Email/password auth for your mates
- **Category Selection** — Pick categories to practice, see progress on each
- **Quiz Loop** — Random unanswered questions, immediate feedback, tracks history
- **Redo** — When a category is complete, reset and practice again
- **Statistics** — Per-category accuracy breakdown and overall progress
- **Admin Panel** — Add/delete questions (text or image), manage categories
- **Role-Based Access** — Admin routes protected by middleware

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** (mobile-first dark theme)
- **Supabase** (Auth, PostgreSQL, Storage)
- **react-hook-form** (Admin question creator)

## Project Structure

```
src/
├── app/
│   ├── login/page.tsx          # Auth page (sign in / sign up)
│   ├── page.tsx                # Player lobby (category selection)
│   ├── quiz/page.tsx           # Quiz loop (questions + answers)
│   ├── stats/page.tsx          # Player statistics
│   └── admin/
│       ├── page.tsx            # Admin dashboard (question list)
│       ├── new/page.tsx        # Create new question
│       └── categories/page.tsx # Manage categories
├── components/
│   ├── AppShell.tsx            # Shared nav shell
│   └── QuestionCard.tsx        # Reusable question display
├── lib/supabase/
│   ├── client.ts               # Browser Supabase client
│   ├── server.ts               # Server Supabase client
│   └── middleware.ts           # Auth + admin middleware logic
└── middleware.ts                # Next.js middleware entry point
```

## Setup

### Prerequisites

- **Node.js >= 18.17**
- **Docker** (for local Supabase)
- **Supabase CLI**: `npm install -g supabase`

### 1. Install dependencies

```bash
npm install
```

### 2. Start local Supabase

```bash
supabase init   # if not already done
supabase start
```

This prints your local API URL and anon key.

### 3. Configure environment

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-from-supabase-start>
```

### 4. Apply database schema

Open the Supabase local Studio at `http://127.0.0.1:54323`, go to the SQL Editor, and run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, RLS policies, RPC functions, storage bucket, and seed categories.

### 5. Create an admin user

1. Sign up through the app's login page
2. In Supabase Studio, Table Editor, `profiles` table — set `is_admin = true` for your user

### 6. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000

### 7. (Optional) Disable email confirmation for local dev

In Supabase Studio, Authentication, Providers, Email — turn off "Confirm email".

## Usage

### As a Player

1. Sign up / Sign in
2. See categories with your progress
3. Select categories, hit "Start Training"
4. Answer questions, get immediate feedback
5. When all questions answered: "Reset and Redo" or go back
6. Check detailed stats on the Stats page

### As an Admin

1. Sign in (must have `is_admin = true` in profiles)
2. Click "Admin" in the nav bar
3. Add questions (text or image type), manage categories
4. Filter questions by category or type
5. Delete questions as needed

## Database Schema

| Table            | Purpose                                                         |
| ---------------- | --------------------------------------------------------------- |
| `profiles`       | User profiles with admin flag, auto-created on signup           |
| `categories`     | Quiz categories (General Knowledge, Science, etc.)              |
| `questions`      | Questions with 3 options, correct answer index, optional image  |
| `user_responses` | Tracks which questions each user answered and whether correctly |

## Deploying to Production

1. Create a Supabase project at supabase.com
2. Run the migration SQL in the cloud SQL Editor
3. Create a storage bucket called `question-images` (set to public)
4. Update `.env.local` with production URL and anon key
5. Deploy to Vercel: `npx vercel`
