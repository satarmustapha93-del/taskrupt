# TaskRupt

TaskRupt is a mobile-first rewards dashboard with an Express API and Supabase Auth/Postgres. Supabase stores profiles, tasks, submissions, wallet history, withdrawals, and reward settings. The server uses a Supabase secret key for validated API operations; the browser only receives the publishable key.

The customer dashboard is served at `/` and the admin demo at `/admin`. The admin screen uses local sample rows for the first visual review; protected `/api/admin/*` endpoints operate on Supabase records.

## Run locally

1. Install Node.js 20+.
2. Create a Supabase project. Copy `.env.example` to `.env`, set the project URL, publishable key, and server-only secret key. Never use a secret key in a `VITE_` variable.
3. Run the SQL files in `supabase/migrations` in filename order. They create the profile trigger, app tables, row-level security rules, and atomic wallet operations, then remove the retired ad-tracking table if it exists.
4. In Supabase Authentication URL settings, allow the local app URL (for example `http://localhost:5173/`) and reset URL (`http://localhost:5173/reset-password`). Configure the production URLs before deploying.
5. Install packages with `npm install`.
6. Run the API with `npm run server` and the frontend with `npm run dev` in separate terminals.
7. Open `http://localhost:5173`. Visit `/signup` or `/login` to use the Supabase-backed account form.

## Import existing MongoDB data

For a one-time import, make sure each existing user already has a matching Supabase Auth account with the same email. MongoDB password hashes cannot be used by Supabase Auth; users need to register or reset their password through Supabase. Temporarily provide `MONGODB_URI` alongside `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, then run `npm run migrate:mongodb`. The script imports profiles, tasks, submissions, wallet transactions, withdrawals, and settings. It leaves MongoDB unchanged; verify the imported records before retiring the old database. The import is intended to run once.

`npm run build` creates the production frontend bundle in `dist/`.

## API outline

- `/api/auth`: current user and daily check-in; signup, login, and password reset use Supabase Auth directly
- `/api/tasks`: list and submit tasks; admin task creation
- `/api/wallet`: wallet and transaction history, withdrawal requests
- `/api/admin`: analytics, submission review, payout review, user status, reward settings

The dashboard and admin page currently use local dummy data. API routes require the Supabase project URL, publishable key, and server-only secret key. Supabase email confirmation and password-reset messages need to be configured in the Supabase dashboard for production. Withdrawal requests are recorded for admin review, but payout execution needs Paystack, bank, or PayPal credentials and provider-specific adapters. AdSense can be added separately when you are ready.

To grant an account admin access, sign up normally, then update its `role` to `admin` in the Supabase SQL Editor: `update public.profiles set role = 'admin' where email = 'you@example.com';`. Keep that operation restricted to trusted operators.
# Local currency defaults

All payout amounts use Nigerian naira (NGN). The demo wallet defaults to 1 token = ₦1 and a ₦5,000 minimum withdrawal. Admins can change the token rate and minimum in reward settings; API settings are stored as `tokensPerNaira` and `minimumWithdrawalNgn`.
