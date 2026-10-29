-- ==========================================
-- B2B RESELLER API & DASHBOARD INFRASTRUCTURE
-- ==========================================

-- RESELLER SETTINGS
create table if not exists public.reseller_settings (
  id int primary key default 1 check (id = 1),
  b2b_enabled boolean not null default true,
  min_deposit numeric(12,2) not null default 20.00,
  default_rate_limit int not null default 60,
  require_approval boolean not null default false,
  default_markup_percent numeric(5,2) not null default 0.00,
  updated_at timestamptz not null default now()
);
grant select on public.reseller_settings to anon, authenticated;
grant update on public.reseller_settings to authenticated;
grant all on public.reseller_settings to service_role;
alter table public.reseller_settings enable row level security;
create policy "public read reseller settings" on public.reseller_settings for select to anon, authenticated using (true);
create policy "admin update reseller settings" on public.reseller_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.reseller_settings(id) values (1) on conflict (id) do nothing;

-- RESELLER ACCOUNTS
create table if not exists public.reseller_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('pending', 'active', 'suspended', 'rejected')),
  company_name text,
  document text,
  phone text,
  max_api_keys int not null default 5,
  rate_limit_per_minute int not null default 60,
  webhook_url text,
  webhook_secret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reseller_accounts_user on public.reseller_accounts(user_id);
grant select, update on public.reseller_accounts to authenticated;
grant insert, select, update, delete on public.reseller_accounts to service_role;
alter table public.reseller_accounts enable row level security;
create policy "own reseller account read" on public.reseller_accounts for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own reseller account update" on public.reseller_accounts for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "reseller account register" on public.reseller_accounts for insert to authenticated with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- RESELLER API KEYS
create table if not exists public.reseller_api_keys (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.reseller_accounts(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  permissions text[] not null default array['read:products','read:wallet','write:orders','read:orders','read:deliveries'],
  rate_limit int not null default 60,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_reseller_keys_hash on public.reseller_api_keys(key_hash);
create index if not exists idx_reseller_keys_reseller on public.reseller_api_keys(reseller_id);
grant select, insert, update on public.reseller_api_keys to authenticated;
grant all on public.reseller_api_keys to service_role;
alter table public.reseller_api_keys enable row level security;
create policy "reseller view keys" on public.reseller_api_keys for select to authenticated using (
  exists (select 1 from public.reseller_accounts a where a.id = reseller_id and (a.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
);
create policy "reseller insert keys" on public.reseller_api_keys for insert to authenticated with check (
  exists (select 1 from public.reseller_accounts a where a.id = reseller_id and (a.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
);
create policy "reseller update keys" on public.reseller_api_keys for update to authenticated using (
  exists (select 1 from public.reseller_accounts a where a.id = reseller_id and (a.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
);

-- RESELLER PRICES
create table if not exists public.reseller_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  reseller_id uuid references public.reseller_accounts(id) on delete cascade, -- null = global B2B cost price
  b2b_price numeric(12,2) not null check (b2b_price >= 0),
  is_b2b_active boolean not null default true,
  min_quantity int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, reseller_id, min_quantity)
);
create index if not exists idx_reseller_prices_lookup on public.reseller_prices(product_id, reseller_id);
grant select on public.reseller_prices to anon, authenticated;
grant all on public.reseller_prices to authenticated;
grant all on public.reseller_prices to service_role;
alter table public.reseller_prices enable row level security;
create policy "read reseller prices" on public.reseller_prices for select to authenticated using (
  reseller_id is null or public.has_role(auth.uid(),'admin') or exists (
    select 1 from public.reseller_accounts a where a.id = reseller_id and a.user_id = auth.uid()
  )
);
create policy "admin manage prices" on public.reseller_prices for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- RESELLER ORDERS
create table if not exists public.reseller_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  reseller_id uuid not null references public.reseller_accounts(id) on delete cascade,
  api_key_id uuid references public.reseller_api_keys(id) on delete set null,
  external_order_id text,
  idempotency_key text,
  created_at timestamptz not null default now()
);
create index if not exists idx_reseller_orders_reseller on public.reseller_orders(reseller_id, created_at desc);
grant select on public.reseller_orders to authenticated;
grant all on public.reseller_orders to service_role;
alter table public.reseller_orders enable row level security;
create policy "read reseller orders" on public.reseller_orders for select to authenticated using (
  exists (select 1 from public.reseller_accounts a where a.id = reseller_id and (a.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
);

-- IDEMPOTENCY RECORDS
create table if not exists public.api_idempotency_records (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.reseller_accounts(id) on delete cascade,
  idempotency_key text not null,
  request_path text not null,
  request_hash text not null,
  response_status int not null,
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  unique (reseller_id, idempotency_key)
);
create index if not exists idx_idempotency_lookup on public.api_idempotency_records(reseller_id, idempotency_key);
grant all on public.api_idempotency_records to service_role;
alter table public.api_idempotency_records enable row level security;

-- RESELLER WEBHOOKS
create table if not exists public.reseller_webhooks (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.reseller_accounts(id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default array['order.created','order.completed','order.failed','delivery.completed','wallet.deposit.completed'],
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.reseller_webhooks to authenticated;
grant all on public.reseller_webhooks to service_role;
alter table public.reseller_webhooks enable row level security;
create policy "manage reseller webhooks" on public.reseller_webhooks for all to authenticated using (
  exists (select 1 from public.reseller_accounts a where a.id = reseller_id and (a.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
);

-- RESELLER WEBHOOK EVENTS LOG
create table if not exists public.reseller_webhook_events (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.reseller_accounts(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  delivery_url text not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts int not null default 0,
  last_response_code int,
  last_error text,
  next_retry_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_webhook_events_reseller on public.reseller_webhook_events(reseller_id, created_at desc);
grant select on public.reseller_webhook_events to authenticated;
grant all on public.reseller_webhook_events to service_role;
alter table public.reseller_webhook_events enable row level security;
create policy "read reseller webhook events" on public.reseller_webhook_events for select to authenticated using (
  exists (select 1 from public.reseller_accounts a where a.id = reseller_id and (a.user_id = auth.uid() or public.has_role(auth.uid(),'admin')))
);

-- RESELLER API LOGS
create table if not exists public.reseller_api_logs (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid references public.reseller_accounts(id) on delete set null,
  api_key_id uuid references public.reseller_api_keys(id) on delete set null,
  endpoint text not null,
  method text not null,
  status_code int not null,
  processing_time_ms int not null,
  request_id text not null,
  ip_address text,
  created_at timestamptz not null default now()
);
create index if not exists idx_api_logs_reseller on public.reseller_api_logs(reseller_id, created_at desc);
grant select on public.reseller_api_logs to authenticated;
grant all on public.reseller_api_logs to service_role;
alter table public.reseller_api_logs enable row level security;
create policy "read reseller api logs" on public.reseller_api_logs for select to authenticated using (
  public.has_role(auth.uid(),'admin') or exists (
    select 1 from public.reseller_accounts a where a.id = reseller_id and a.user_id = auth.uid()
  )
);

-- RESELLER REFUND REQUESTS
create table if not exists public.reseller_refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reseller_id uuid not null references public.reseller_accounts(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_reseller_refunds on public.reseller_refund_requests(reseller_id, created_at desc);
grant select, insert on public.reseller_refund_requests to authenticated;
grant update on public.reseller_refund_requests to authenticated;
grant all on public.reseller_refund_requests to service_role;
alter table public.reseller_refund_requests enable row level security;
create policy "reseller read refund requests" on public.reseller_refund_requests for select to authenticated using (
  public.has_role(auth.uid(),'admin') or exists (
    select 1 from public.reseller_accounts a where a.id = reseller_id and a.user_id = auth.uid()
  )
);
create policy "reseller create refund request" on public.reseller_refund_requests for insert to authenticated with check (
  exists (select 1 from public.reseller_accounts a where a.id = reseller_id and a.user_id = auth.uid())
);
create policy "admin update refund request" on public.reseller_refund_requests for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- RESELLER DEPOSITS (PIX TOPUPS)
create table if not exists public.reseller_deposits (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.reseller_accounts(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  pix_code text,
  pix_qr_url text,
  gateway_ref text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_reseller_deposits on public.reseller_deposits(reseller_id, created_at desc);
grant select, insert on public.reseller_deposits to authenticated;
grant all on public.reseller_deposits to service_role;
alter table public.reseller_deposits enable row level security;
create policy "reseller read deposits" on public.reseller_deposits for select to authenticated using (
  public.has_role(auth.uid(),'admin') or exists (
    select 1 from public.reseller_accounts a where a.id = reseller_id and a.user_id = auth.uid()
  )
);
create policy "reseller insert deposits" on public.reseller_deposits for insert to authenticated with check (
  exists (select 1 from public.reseller_accounts a where a.id = reseller_id and a.user_id = auth.uid())
);

-- ==========================================
-- B2B BUSINESS FUNCTIONS (SECURITY DEFINER)
-- ==========================================

-- 1. Helper function: Get custom B2B price for a reseller
create or replace function public.b2b_get_product_price(_product_id uuid, _reseller_id uuid default null)
returns table (
  price numeric(12,2),
  is_b2b_available boolean
) language plpgsql security definer set search_path = public as $$
declare
  _prod record;
  _rp record;
  _global_rp record;
begin
  select * into _prod from products where id = _product_id;
  if not found or not _prod.active then
    return query select 0::numeric(12,2), false;
    return;
  end if;

  -- 1. Check custom reseller price
  if _reseller_id is not null then
    select * into _rp from reseller_prices
    where product_id = _product_id and reseller_id = _reseller_id
    limit 1;
    if found and _rp.is_b2b_active then
      return query select _rp.b2b_price, true;
      return;
    elsif found and not _rp.is_b2b_active then
      return query select 0::numeric(12,2), false;
      return;
    end if;
  end if;

  -- 2. Check global B2B price
  select * into _global_rp from reseller_prices
  where product_id = _product_id and reseller_id is null
  limit 1;
  if found and _global_rp.is_b2b_active then
    return query select _global_rp.b2b_price, true;
    return;
  elsif found and not _global_rp.is_b2b_active then
    return query select 0::numeric(12,2), false;
    return;
  end if;

  -- 3. Default fallback: promo_price or price
  return query select coalesce(_prod.promo_price, _prod.price), true;
end $$;

-- 2. Purchase function via B2B API
create or replace function public.b2b_order_purchase(
  _reseller_id uuid,
  _api_key_id uuid,
  _product_id uuid,
  _quantity int,
  _external_order_id text default null,
  _idempotency_key text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  _reseller record;
  _prod record;
  _unit_price numeric(12,2);
  _is_avail boolean;
  _total numeric(12,2);
  _wallet record;
  _order_id uuid;
  _order_number bigint;
  _item_id uuid;
  _existing_idem record;
  _delivery_status text := 'pending';
  _delivery_content text := null;
  _d record;
begin
  -- Validate quantity
  if _quantity is null or _quantity < 1 then
    raise exception 'Quantidade inválida';
  end if;

  -- Check idempotency
  if _idempotency_key is not null and length(trim(_idempotency_key)) > 0 then
    select * into _existing_idem from api_idempotency_records
    where reseller_id = _reseller_id and idempotency_key = trim(_idempotency_key);
    if found then
      return _existing_idem.response_body;
    end if;
  end if;

  -- Fetch and validate reseller account
  select * into _reseller from reseller_accounts where id = _reseller_id for update;
  if not found then
    raise exception 'Conta de revendedor não encontrada';
  end if;
  if _reseller.status <> 'active' then
    raise exception 'Conta de revendedor suspensa ou inativa';
  end if;

  -- Lock and validate product
  select * into _prod from products where id = _product_id and active for update;
  if not found then
    raise exception 'Produto indisponível ou inexistente';
  end if;

  if _prod.stock is not null and _prod.stock < _quantity then
    raise exception 'Estoque insuficiente no momento';
  end if;

  -- Get B2B cost price
  select price, is_b2b_available into _unit_price, _is_avail
  from b2b_get_product_price(_product_id, _reseller_id);

  if not _is_avail then
    raise exception 'Produto não está habilitado para revenda B2B';
  end if;

  _total := round(_unit_price * _quantity, 2);

  -- Lock wallet
  select * into _wallet from wallets where user_id = _reseller.user_id for update;
  if not found then
    insert into wallets(user_id, balance) values (_reseller.user_id, 0)
    returning * into _wallet;
  end if;

  if _wallet.balance < _total then
    raise exception 'Saldo insuficiente na carteira B2B (Saldo: R$ %, Necessário: R$ %)', _wallet.balance, _total;
  end if;

  -- Deduct wallet atomically
  update wallets
  set balance = balance - _total, updated_at = now()
  where user_id = _reseller.user_id;

  -- Create master order
  insert into orders(
    user_id,
    subtotal,
    discount,
    total,
    status,
    payment_method,
    paid_at
  ) values (
    _reseller.user_id,
    _total,
    0,
    _total,
    'pago',
    'carteira_b2b',
    now()
  ) returning id, number into _order_id, _order_number;

  -- Insert order items
  insert into order_items(
    order_id,
    product_id,
    product_name,
    unit_price,
    quantity
  ) values (
    _order_id,
    _prod.id,
    _prod.name,
    _unit_price,
    _quantity
  ) returning id into _item_id;

  -- Record payment
  insert into payments(
    order_id,
    user_id,
    provider,
    amount,
    status
  ) values (
    _order_id,
    _reseller.user_id,
    'carteira_b2b',
    _total,
    'aprovado'
  );

  -- Record wallet transaction
  insert into wallet_transactions(
    user_id,
    amount,
    kind,
    description,
    order_id
  ) values (
    _reseller.user_id,
    -_total,
    'compra',
    'Compra B2B API - Pedido #' || _order_number || ' (' || _prod.name || ')',
    _order_id
  );

  -- Record B2B order metadata
  insert into reseller_orders(
    order_id,
    reseller_id,
    api_key_id,
    external_order_id,
    idempotency_key
  ) values (
    _order_id,
    _reseller_id,
    _api_key_id,
    _external_order_id,
    _idempotency_key
  );

  -- Execute delivery logic via finalize_paid_order
  perform finalize_paid_order(_order_id);

  -- Fetch delivery status
  select * into _d from deliveries where order_id = _order_id limit 1;
  if found then
    _delivery_status := case
      when _d.status = 'entregue' then 'completed'
      when _d.status = 'problema' then 'failed'
      else 'pending'
    end;
    _delivery_content := _d.content;
  end if;

  -- Build response payload
  declare
    _res jsonb;
  begin
    _res := jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'order_id', 'ORD-' || _order_number,
        'internal_id', _order_id,
        'external_order_id', _external_order_id,
        'product_id', _product_id,
        'product_name', _prod.name,
        'quantity', _quantity,
        'unit_price', _unit_price,
        'amount', _total,
        'currency', 'BRL',
        'status', 'completed',
        'delivery_status', _delivery_status,
        'delivery_type', _prod.delivery_type,
        'created_at', now()
      )
    );

    -- Store idempotency record if requested
    if _idempotency_key is not null and length(trim(_idempotency_key)) > 0 then
      insert into api_idempotency_records(
        reseller_id,
        idempotency_key,
        request_path,
        request_hash,
        response_status,
        response_body
      ) values (
        _reseller_id,
        trim(_idempotency_key),
        '/api/v1/orders',
        md5(_product_id::text || ':' || _quantity::text),
        200,
        _res
      ) on conflict (reseller_id, idempotency_key) do nothing;
    end if;

    return _res;
  end;
end $$;

-- 3. Confirm deposit / PIX recharge
create or replace function public.b2b_confirm_deposit(
  _deposit_id uuid,
  _admin_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  _dep record;
  _reseller record;
begin
  select * into _dep from reseller_deposits where id = _deposit_id for update;
  if not found then
    raise exception 'Depósito não encontrado';
  end if;
  if _dep.status = 'paid' then
    return; -- already credited
  end if;

  select * into _reseller from reseller_accounts where id = _dep.reseller_id;
  if not found then
    raise exception 'Revendedor não encontrado';
  end if;

  -- Update wallet
  update wallets
  set balance = balance + _dep.amount, updated_at = now()
  where user_id = _reseller.user_id;

  -- Record wallet transaction
  insert into wallet_transactions(
    user_id,
    amount,
    kind,
    description
  ) values (
    _reseller.user_id,
    _dep.amount,
    'recarga',
    'Recarga PIX B2B - Depósito ' || substr(_dep.id::text, 1, 8)
  );

  -- Update deposit status
  update reseller_deposits
  set status = 'paid', paid_at = now()
  where id = _deposit_id;

  if _admin_id is not null then
    insert into audit_logs(actor_id, action, details)
    values (_admin_id, 'confirmar_deposito_b2b', jsonb_build_object('deposit_id', _deposit_id, 'amount', _dep.amount));
  end if;
end $$;

-- 4. Process refund request
create or replace function public.b2b_process_refund_request(
  _request_id uuid,
  _admin_id uuid,
  _approve boolean,
  _notes text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  _req record;
  _reseller record;
  _o record;
begin
  select * into _req from reseller_refund_requests where id = _request_id for update;
  if not found then
    raise exception 'Solicitação de reembolso não encontrada';
  end if;
  if _req.status <> 'pending' then
    raise exception 'Solicitação já processada anteriormente';
  end if;

  select * into _reseller from reseller_accounts where id = _req.reseller_id;
  select * into _o from orders where id = _req.order_id for update;

  if _approve then
    -- Credit wallet
    update wallets
    set balance = balance + _req.amount, updated_at = now()
    where user_id = _reseller.user_id;

    -- Record transaction
    insert into wallet_transactions(
      user_id,
      amount,
      kind,
      description,
      order_id
    ) values (
      _reseller.user_id,
      _req.amount,
      'reembolso',
      'Reembolso B2B aprovado - Pedido #' || _o.number || ' (' || _req.reason || ')',
      _req.order_id
    );

    update orders set status = 'reembolsado' where id = _req.order_id;
    update reseller_refund_requests
    set status = 'approved', admin_notes = _notes, reviewed_by = _admin_id, reviewed_at = now()
    where id = _request_id;
  else
    update reseller_refund_requests
    set status = 'rejected', admin_notes = _notes, reviewed_by = _admin_id, reviewed_at = now()
    where id = _request_id;
  end if;

  insert into audit_logs(actor_id, action, details)
  values (_admin_id, case when _approve then 'b2b_reembolso_aprovado' else 'b2b_reembolso_rejeitado' end,
    jsonb_build_object('refund_request_id', _request_id, 'order_id', _req.order_id, 'amount', _req.amount, 'notes', _notes));
end $$;
