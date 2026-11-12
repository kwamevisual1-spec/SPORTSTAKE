# SportStake database – run order

1. `schema.sql`          – base tables, wallets, ledger, bets (includes PATCH 1 and PATCH 2 at the bottom – run those too)
2. `admin_agents.sql`    – Super Admin, agents, referrals, commissions, audit log (this file is safe to re-run)
3. Supabase → Authentication → Users → Add user (tick "Auto Confirm User") for YOUR admin login
4. SQL editor, run once:  `select public.bootstrap_super_admin('you@example.com');`
5. Open  https://YOUR-SITE/#/admin  → sign in → scan the QR with Google Authenticator → done.

Agents sign in at  https://YOUR-SITE/#/agent
Referral links look like  https://YOUR-SITE/?ref=AGENT001

## If "Add user" in Supabase says "Database error creating new user"
1. Run `fix_add_user.sql` (safe to repeat), then try again.
   (Known cause: a NOT NULL `country` column on `profiles` that the sign-up trigger did not fill. The fix relaxes it and fills it from the currency.)
2. Still failing? Run `diagnose_add_user.sql` (read-only) and send the result, plus the ERROR line from
   Supabase → Logs → Postgres Logs at the time you clicked Create user.

## Migration order (run in this order)
1. schema.sql
2. admin_agents.sql
3. markets_admin.sql  ← detailed football markets (admin + settlement)
4. verify.sql / diagnose_add_user.sql if anything looks wrong
