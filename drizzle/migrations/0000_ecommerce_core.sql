
create type public.app_role as enum ('admin','user');
create type public.order_status as enum ('pendente','pago','entregue','cancelado','reembolsado');
create type public.delivery_type as enum ('licenca','arquivo','manual');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  status text not null default 'ativo',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- WALLETS
create table public.wallets (
  user_id uuid primary key,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "own wallet" on public.wallets for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric(12,2) not null,
  kind text not null, -- recarga, compra, reembolso, ajuste
  description text,
  order_id uuid,
  created_at timestamptz not null default now()
);
create index on public.wallet_transactions(user_id, created_at desc);
grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;
create policy "own wallet tx" on public.wallet_transactions for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- NEW USER TRIGGER (first user becomes admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.email);
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  insert into public.wallets(user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- CATEGORIES
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  icon text,
  sort_order int not null default 0
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "public categories" on public.categories for select to anon, authenticated using (true);
create policy "admin categories" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- PRODUCTS
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  short_description text,
  description text,
  image_url text,
  price numeric(12,2) not null check (price >= 0),
  promo_price numeric(12,2) check (promo_price >= 0),
  benefits text[] not null default '{}',
  features text[] not null default '{}',
  delivery_info text,
  delivery_type delivery_type not null default 'manual',
  delivery_file_url text,
  stock int, -- null = ilimitado
  active boolean not null default true,
  featured boolean not null default false,
  bestseller boolean not null default false,
  is_new boolean not null default false,
  demo_price boolean not null default true,
  promo_ends_at timestamptz,
  sales_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products(category_id);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public active products" on public.products for select to anon, authenticated using (active or public.has_role(auth.uid(),'admin'));
create policy "admin products" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
-- hide file url from public via column privileges
revoke select (delivery_file_url) on public.products from anon, authenticated;

-- LICENSES
create table public.product_licenses (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  license_key text not null,
  order_item_id uuid unique,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(product_id, license_key)
);
grant select, insert, update, delete on public.product_licenses to authenticated;
grant all on public.product_licenses to service_role;
alter table public.product_licenses enable row level security;
create policy "admin licenses" on public.product_licenses for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- COUPONS
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null check (discount_type in ('percentual','fixo')),
  value numeric(12,2) not null check (value > 0),
  min_total numeric(12,2) not null default 0,
  max_uses int,
  per_user_limit int,
  used_count int not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.coupons to authenticated;
grant all on public.coupons to service_role;
alter table public.coupons enable row level security;
create policy "admin coupons" on public.coupons for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ORDERS
create sequence public.order_number_seq start 1001;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.order_number_seq'),
  user_id uuid not null,
  status order_status not null default 'pendente',
  subtotal numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  coupon_id uuid references public.coupons(id),
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.orders(user_id, created_at desc);
grant select on public.orders to authenticated;
grant update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "own orders" on public.orders for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null,
  quantity int not null check (quantity > 0)
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "own order items" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  user_id uuid not null,
  provider text not null, -- carteira, mercadopago, manual
  provider_payment_id text unique,
  amount numeric(12,2) not null,
  status text not null default 'pendente',
  created_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "own payments" on public.payments for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null,
  delivery_type delivery_type not null,
  status text not null default 'aguardando', -- aguardando, entregue, problema
  content text, -- chave de licença / link / instruções
  admin_note text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.deliveries to authenticated;
grant all on public.deliveries to service_role;
alter table public.deliveries enable row level security;
create policy "own deliveries" on public.deliveries for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin deliveries" on public.deliveries for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- FAVORITES
create table public.favorites (
  user_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;
alter table public.favorites enable row level security;
create policy "own favorites" on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- SUPPORT
create sequence public.ticket_seq start 5001;
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique default ('SUP-' || nextval('public.ticket_seq')),
  user_id uuid not null,
  category text not null,
  subject text not null,
  status text not null default 'aberto',
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
alter table public.support_tickets enable row level security;
create policy "own tickets read" on public.support_tickets for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own tickets insert" on public.support_tickets for insert to authenticated with check (user_id = auth.uid() and status = 'aberto');
create policy "admin tickets update" on public.support_tickets for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null,
  is_staff boolean not null default false,
  body text not null check (length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
grant select, insert on public.support_messages to authenticated;
grant all on public.support_messages to service_role;
alter table public.support_messages enable row level security;
create policy "ticket messages read" on public.support_messages for select to authenticated using (
  exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));
create policy "ticket messages insert" on public.support_messages for insert to authenticated with check (
  author_id = auth.uid() and (
    (is_staff = false and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()))
    or (public.has_role(auth.uid(),'admin'))));

-- STORE SETTINGS (single row)
create table public.store_settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'NexaTools',
  support_email text default 'suporte@exemplo.com',
  whatsapp text default '',
  instagram text default '',
  company_info text default '',
  privacy_policy text default '',
  terms text default '',
  updated_at timestamptz not null default now()
);
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;
grant all on public.store_settings to service_role;
alter table public.store_settings enable row level security;
create policy "public settings" on public.store_settings for select to anon, authenticated using (true);
create policy "admin settings" on public.store_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.store_settings(id) values (1);

-- AUDIT
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "admin audit" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- ===== BUSINESS FUNCTIONS =====
create or replace function public.create_order(_items jsonb, _coupon text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _order uuid; _sub numeric(12,2) := 0; _disc numeric(12,2) := 0;
  _it jsonb; _p record; _qty int; _c record; _uses int;
begin
  if _uid is null then raise exception 'Faça login para comprar'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Carrinho vazio'; end if;
  insert into orders(user_id, subtotal, total) values (_uid, 0, 0) returning id into _order;
  for _it in select * from jsonb_array_elements(_items) loop
    _qty := greatest(1, least(coalesce((_it->>'quantity')::int,1), 50));
    select * into _p from products where id = (_it->>'product_id')::uuid and active;
    if not found then raise exception 'Produto indisponível'; end if;
    if _p.stock is not null and _p.stock < _qty then raise exception 'Estoque insuficiente: %', _p.name; end if;
    insert into order_items(order_id, product_id, product_name, unit_price, quantity)
      values (_order, _p.id, _p.name, coalesce(_p.promo_price, _p.price), _qty);
    _sub := _sub + coalesce(_p.promo_price, _p.price) * _qty;
  end loop;
  if _coupon is not null and length(trim(_coupon)) > 0 then
    select * into _c from coupons where upper(code) = upper(trim(_coupon)) and active for update;
    if not found then raise exception 'Cupom inválido'; end if;
    if _c.expires_at is not null and _c.expires_at < now() then raise exception 'Cupom expirado'; end if;
    if _c.max_uses is not null and _c.used_count >= _c.max_uses then raise exception 'Cupom esgotado'; end if;
    if _sub < _c.min_total then raise exception 'Valor mínimo para o cupom: R$ %', _c.min_total; end if;
    if _c.per_user_limit is not null then
      select count(*) into _uses from orders where user_id = _uid and coupon_id = _c.id and status <> 'cancelado';
      if _uses >= _c.per_user_limit then raise exception 'Limite de uso do cupom atingido'; end if;
    end if;
    _disc := case when _c.discount_type = 'percentual' then round(_sub * least(_c.value,100) / 100, 2) else least(_c.value, _sub) end;
    update orders set coupon_id = _c.id where id = _order;
  end if;
  update orders set subtotal = _sub, discount = _disc, total = _sub - _disc where id = _order;
  return _order;
end $$;

-- internal: finalize a paid order (stock, coupon, deliveries). Not callable by clients.
create or replace function public.finalize_paid_order(_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _o record; _i record; _p record; _lic record;
begin
  select * into _o from orders where id = _order for update;
  if _o.status <> 'pago' then raise exception 'Pedido não está pago'; end if;
  if _o.coupon_id is not null then update coupons set used_count = used_count + 1 where id = _o.coupon_id; end if;
  for _i in select * from order_items where order_id = _order loop
    select * into _p from products where id = _i.product_id for update;
    if found then
      update products set sales_count = sales_count + _i.quantity,
        stock = case when stock is null then null else greatest(stock - _i.quantity, 0) end where id = _p.id;
      if _p.delivery_type = 'licenca' then
        select * into _lic from product_licenses where product_id = _p.id and order_item_id is null
          order by created_at limit 1 for update skip locked;
        if found then
          update product_licenses set order_item_id = _i.id, delivered_at = now() where id = _lic.id;
          insert into deliveries(order_item_id, order_id, user_id, delivery_type, status, content, delivered_at)
            values (_i.id, _order, _o.user_id, 'licenca', 'entregue', _lic.license_key, now());
        else
          insert into deliveries(order_item_id, order_id, user_id, delivery_type, status, admin_note)
            values (_i.id, _order, _o.user_id, 'licenca', 'problema', 'Sem licenças disponíveis em estoque');
        end if;
      elsif _p.delivery_type = 'arquivo' and _p.delivery_file_url is not null then
        insert into deliveries(order_item_id, order_id, user_id, delivery_type, status, content, delivered_at)
          values (_i.id, _order, _o.user_id, 'arquivo', 'entregue', _p.delivery_file_url, now());
      else
        insert into deliveries(order_item_id, order_id, user_id, delivery_type, status)
          values (_i.id, _order, _o.user_id, _p.delivery_type, 'aguardando');
      end if;
    end if;
  end loop;
  if not exists (select 1 from deliveries where order_id = _order and status <> 'entregue') then
    update orders set status = 'entregue' where id = _order;
  end if;
end $$;
revoke execute on function public.finalize_paid_order(uuid) from public, anon, authenticated;

create or replace function public.pay_order_with_wallet(_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _o record; _w record;
begin
  select * into _o from orders where id = _order for update;
  if not found or _o.user_id <> auth.uid() then raise exception 'Pedido não encontrado'; end if;
  if _o.status <> 'pendente' then raise exception 'Este pedido já foi processado'; end if;
  select * into _w from wallets where user_id = _o.user_id for update;
  if _w.balance < _o.total then raise exception 'Saldo insuficiente'; end if;
  update wallets set balance = balance - _o.total, updated_at = now() where user_id = _o.user_id;
  insert into wallet_transactions(user_id, amount, kind, description, order_id)
    values (_o.user_id, -_o.total, 'compra', 'Pedido #' || _o.number, _o.id);
  insert into payments(order_id, user_id, provider, amount, status) values (_o.id, _o.user_id, 'carteira', _o.total, 'aprovado');
  update orders set status = 'pago', payment_method = 'carteira', paid_at = now() where id = _order;
  perform finalize_paid_order(_order);
end $$;

create or replace function public.admin_confirm_payment(_order uuid, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare _o record;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Acesso negado'; end if;
  select * into _o from orders where id = _order for update;
  if _o.status <> 'pendente' then raise exception 'Pedido não está pendente'; end if;
  insert into payments(order_id, user_id, provider, amount, status) values (_o.id, _o.user_id, 'manual', _o.total, 'aprovado');
  update orders set status = 'pago', payment_method = 'manual', paid_at = now() where id = _order;
  perform finalize_paid_order(_order);
  insert into audit_logs(actor_id, action, details) values (auth.uid(), 'confirmar_pagamento_manual', jsonb_build_object('order', _order, 'note', _note));
end $$;

create or replace function public.admin_cancel_order(_order uuid, _refund boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare _o record;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Acesso negado'; end if;
  select * into _o from orders where id = _order for update;
  if _o.status in ('cancelado','reembolsado') then raise exception 'Pedido já encerrado'; end if;
  if _refund and _o.status in ('pago','entregue') then
    update wallets set balance = balance + _o.total, updated_at = now() where user_id = _o.user_id;
    insert into wallet_transactions(user_id, amount, kind, description, order_id)
      values (_o.user_id, _o.total, 'reembolso', 'Reembolso pedido #' || _o.number, _o.id);
    update orders set status = 'reembolsado' where id = _order;
  else
    update orders set status = 'cancelado' where id = _order;
  end if;
  insert into audit_logs(actor_id, action, details) values (auth.uid(), case when _refund then 'reembolsar_pedido' else 'cancelar_pedido' end, jsonb_build_object('order', _order));
end $$;

create or replace function public.admin_adjust_wallet(_user uuid, _amount numeric, _note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Acesso negado'; end if;
  if _note is null or length(trim(_note)) < 3 then raise exception 'Informe o motivo do ajuste'; end if;
  insert into wallets(user_id) values (_user) on conflict do nothing;
  update wallets set balance = balance + _amount, updated_at = now() where user_id = _user; -- check prevents negative
  insert into wallet_transactions(user_id, amount, kind, description) values (_user, _amount, 'ajuste', _note);
  insert into audit_logs(actor_id, action, details) values (auth.uid(), 'ajuste_carteira', jsonb_build_object('user', _user, 'amount', _amount, 'note', _note));
end $$;

create or replace function public.admin_deliver_manual(_delivery uuid, _content text)
returns void language plpgsql security definer set search_path = public as $$
declare _d record;
begin
  if not has_role(auth.uid(),'admin') then raise exception 'Acesso negado'; end if;
  update deliveries set status = 'entregue', content = _content, delivered_at = now() where id = _delivery returning * into _d;
  if not exists (select 1 from deliveries where order_id = _d.order_id and status <> 'entregue') then
    update orders set status = 'entregue' where id = _d.order_id and status = 'pago';
  end if;
  insert into audit_logs(actor_id, action, details) values (auth.uid(), 'entrega_manual', jsonb_build_object('delivery', _delivery));
end $$;

-- ===== SEED =====
insert into public.categories(slug, name, description, icon, sort_order) values
 ('automacao-whatsapp','Automação WhatsApp','Ferramentas para automatizar atendimento e envios','MessageCircle',1),
 ('prospeccao-leads','Prospecção e Leads','Encontre e organize contatos para o seu negócio','Target',2),
 ('inteligencia-artificial','Inteligência Artificial','Soluções com IA para produtividade e criação','Sparkles',3),
 ('marketing-comunicacao','Marketing e Comunicação','Campanhas, e-mail, SMS e canais digitais','Megaphone',4),
 ('ferramentas-digitais','Ferramentas Digitais','Utilitários e sistemas para o dia a dia','Wrench',5);

with p(name, cat, n) as (values
 ('Bulk Button Pro','automacao-whatsapp',1),('Business Sender','automacao-whatsapp',2),('Wa Sender','automacao-whatsapp',3),
 ('DSZap','automacao-whatsapp',4),('Maturador','automacao-whatsapp',5),('RoboPro','automacao-whatsapp',6),
 ('Sender','automacao-whatsapp',7),('UltraBot','automacao-whatsapp',8),('Whatsup','automacao-whatsapp',9),('Botmaster','automacao-whatsapp',10),
 ('B2B','prospeccao-leads',11),('Lead Google Pro','prospeccao-leads',12),('Lead Wave','prospeccao-leads',13),('LinkedIn','prospeccao-leads',14),
 ('OLX','prospeccao-leads',15),('Social Data Extractor','prospeccao-leads',16),('CNPJ','prospeccao-leads',17),
 ('Omnius AI','inteligencia-artificial',18),('ImagemPro','inteligencia-artificial',19),('Lovable','inteligencia-artificial',20),('Planeja','inteligencia-artificial',21),
 ('Email','marketing-comunicacao',22),('SMS Pro','marketing-comunicacao',23),('SMStop','marketing-comunicacao',24),('Tele','marketing-comunicacao',25),('YouTube','marketing-comunicacao',26),
 ('CRM','ferramentas-digitais',27),('Lion','ferramentas-digitais',28),('Pro','ferramentas-digitais',29),('Top','ferramentas-digitais',30))
insert into public.products(slug, name, category_id, short_description, description, image_url, price, promo_price, benefits, features, delivery_info, featured, bestseller, is_new, promo_ends_at)
select
  lower(regexp_replace(p.name, '[^a-zA-Z0-9]+', '-', 'g')),
  p.name,
  c.id,
  'Ferramenta digital da categoria ' || c.name || '. Descrição provisória — edite no painel.',
  'Esta é uma descrição provisória do produto ' || p.name || '. O administrador deve substituir este texto pelas características reais, requisitos e condições de uso antes de iniciar as vendas.',
  '/images/cat-' || p.cat || '.jpg',
  97.00, case when p.n % 3 = 0 then 67.00 else null end,
  array['Acesso digital','Suporte pela central de atendimento','Atualizações conforme o fornecedor'],
  array['Funcionalidade 1 (a definir pelo administrador)','Funcionalidade 2 (a definir pelo administrador)','Funcionalidade 3 (a definir pelo administrador)'],
  'Entrega digital pelo painel do cliente após a confirmação do pagamento.',
  p.n in (1,12,18,22,27,8), p.n in (3,6,13,19,23,28), p.n in (20,21,16,25,29,10),
  case when p.n % 3 = 0 then now() + interval '7 days' else null end
from p join public.categories c on c.slug = p.cat;
