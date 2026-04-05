-- ============================================================
-- Supabase SQL Functions for Balance Management
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── increment_balance_by_user ────────────────────────────────
-- Atomically adds amount to user's balance (used on payment approve)

create or replace function increment_balance_by_user(uid uuid, amount_input numeric)
returns void as $$
begin
  update profiles
  set balance = balance + amount_input
  where id = uid;
end;
$$ language plpgsql security definer;


-- ─── decrement_balance_by_user ────────────────────────────────
-- Atomically deducts amount ONLY if balance >= amount (no negative balance)

create or replace function decrement_balance_by_user(uid uuid, amount_input numeric)
returns void as $$
begin
  update profiles
  set balance = balance - amount_input
  where id = uid
    and balance >= amount_input;

  if not found then
    raise exception 'Insufficient balance or user not found';
  end if;
end;
$$ language plpgsql security definer;


-- ─── Grant execution rights ───────────────────────────────────
-- Allow authenticated users and the service role to call these functions

grant execute on function increment_balance_by_user(uuid, numeric) to authenticated;
grant execute on function increment_balance_by_user(uuid, numeric) to service_role;

grant execute on function decrement_balance_by_user(uuid, numeric) to authenticated;
grant execute on function decrement_balance_by_user(uuid, numeric) to service_role;
