
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
  content text, -- chave de licenÃ§a / link / instruÃ§Ãµes
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
  if _uid is null then raise exception 'FaÃ§a login para comprar'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Carrinho vazio'; end if;
  insert into orders(user_id, subtotal, total) values (_uid, 0, 0) returning id into _order;
  for _it in select * from jsonb_array_elements(_items) loop
    _qty := greatest(1, least(coalesce((_it->>'quantity')::int,1), 50));
    select * into _p from products where id = (_it->>'product_id')::uuid and active;
    if not found then raise exception 'Produto indisponÃ­vel'; end if;
    if _p.stock is not null and _p.stock < _qty then raise exception 'Estoque insuficiente: %', _p.name; end if;
    insert into order_items(order_id, product_id, product_name, unit_price, quantity)
      values (_order, _p.id, _p.name, coalesce(_p.promo_price, _p.price), _qty);
    _sub := _sub + coalesce(_p.promo_price, _p.price) * _qty;
  end loop;
  if _coupon is not null and length(trim(_coupon)) > 0 then
    select * into _c from coupons where upper(code) = upper(trim(_coupon)) and active for update;
    if not found then raise exception 'Cupom invÃ¡lido'; end if;
    if _c.expires_at is not null and _c.expires_at < now() then raise exception 'Cupom expirado'; end if;
    if _c.max_uses is not null and _c.used_count >= _c.max_uses then raise exception 'Cupom esgotado'; end if;
    if _sub < _c.min_total then raise exception 'Valor mÃ­nimo para o cupom: R$ %', _c.min_total; end if;
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
  if _o.status <> 'pago' then raise exception 'Pedido nÃ£o estÃ¡ pago'; end if;
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
            values (_i.id, _order, _o.user_id, 'licenca', 'problema', 'Sem licenÃ§as disponÃ­veis em estoque');
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
  if not found or _o.user_id <> auth.uid() then raise exception 'Pedido nÃ£o encontrado'; end if;
  if _o.status <> 'pendente' then raise exception 'Este pedido jÃ¡ foi processado'; end if;
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
  if _o.status <> 'pendente' then raise exception 'Pedido nÃ£o estÃ¡ pendente'; end if;
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
  if _o.status in ('cancelado','reembolsado') then raise exception 'Pedido jÃ¡ encerrado'; end if;
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
 ('automacao-whatsapp','AutomaÃ§Ã£o WhatsApp','Ferramentas para automatizar atendimento e envios','MessageCircle',1),
 ('prospeccao-leads','ProspecÃ§Ã£o e Leads','Encontre e organize contatos para o seu negÃ³cio','Target',2),
 ('inteligencia-artificial','InteligÃªncia Artificial','SoluÃ§Ãµes com IA para produtividade e criaÃ§Ã£o','Sparkles',3),
 ('marketing-comunicacao','Marketing e ComunicaÃ§Ã£o','Campanhas, e-mail, SMS e canais digitais','Megaphone',4),
 ('ferramentas-digitais','Ferramentas Digitais','UtilitÃ¡rios e sistemas para o dia a dia','Wrench',5);

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
  'Ferramenta digital da categoria ' || c.name || '. DescriÃ§Ã£o provisÃ³ria â€” edite no painel.',
  'Esta Ã© uma descriÃ§Ã£o provisÃ³ria do produto ' || p.name || '. O administrador deve substituir este texto pelas caracterÃ­sticas reais, requisitos e condiÃ§Ãµes de uso antes de iniciar as vendas.',
  '/images/cat-' || p.cat || '.jpg',
  97.00, case when p.n % 3 = 0 then 67.00 else null end,
  array['Acesso digital','Suporte pela central de atendimento','AtualizaÃ§Ãµes conforme o fornecedor'],
  array['Funcionalidade 1 (a definir pelo administrador)','Funcionalidade 2 (a definir pelo administrador)','Funcionalidade 3 (a definir pelo administrador)'],
  'Entrega digital pelo painel do cliente apÃ³s a confirmaÃ§Ã£o do pagamento.',
  p.n in (1,12,18,22,27,8), p.n in (3,6,13,19,23,28), p.n in (20,21,16,25,29,10),
  case when p.n % 3 = 0 then now() + interval '7 days' else null end
from p join public.categories c on c.slug = p.cat;

create table public.product_files (
  product_id uuid primary key references public.products(id) on delete cascade,
  file_url text not null,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.product_files to authenticated;
grant all on public.product_files to service_role;
alter table public.product_files enable row level security;
create policy "admin files" on public.product_files for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
update public.products set delivery_file_url = null;
comment on column public.products.delivery_file_url is 'DEPRECATED: replaced by product_files.file_url (admin-only). Keep null.';
create or replace function public.products_block_file_url() returns trigger language plpgsql as $$
begin new.delivery_file_url := null; return new; end $$;
create trigger products_block_file_url before insert or update on public.products for each row execute function public.products_block_file_url();

create or replace function public.finalize_paid_order(_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare _o record; _i record; _p record; _lic record; _f text;
begin
  select * into _o from orders where id = _order for update;
  if _o.status <> 'pago' then raise exception 'Pedido nÃ£o estÃ¡ pago'; end if;
  if _o.coupon_id is not null then update coupons set used_count = used_count + 1 where id = _o.coupon_id; end if;
  for _i in select * from order_items where order_id = _order loop
    select * into _p from products where id = _i.product_id for update;
    if found then
      update products set sales_count = sales_count + _i.quantity,
        stock = case when stock is null then null else greatest(stock - _i.quantity, 0) end where id = _p.id;
      _f := (select file_url from product_files where product_id = _p.id);
      if _p.delivery_type = 'licenca' then
        select * into _lic from product_licenses where product_id = _p.id and order_item_id is null
          order by created_at limit 1 for update skip locked;
        if found then
          update product_licenses set order_item_id = _i.id, delivered_at = now() where id = _lic.id;
          insert into deliveries(order_item_id, order_id, user_id, delivery_type, status, content, delivered_at)
            values (_i.id, _order, _o.user_id, 'licenca', 'entregue', _lic.license_key, now());
        else
          insert into deliveries(order_item_id, order_id, user_id, delivery_type, status, admin_note)
            values (_i.id, _order, _o.user_id, 'licenca', 'problema', 'Sem licenÃ§as disponÃ­veis em estoque');
        end if;
      elsif _p.delivery_type = 'arquivo' and _f is not null then
        insert into deliveries(order_item_id, order_id, user_id, delivery_type, status, content, delivered_at)
          values (_i.id, _order, _o.user_id, 'arquivo', 'entregue', _f, now());
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

-- STORAGE BUCKET FOR PRODUCT IMAGES
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
create policy "read product images" on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');
create policy "admin upload product images" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'));
create policy "admin update product images" on storage.objects for update to authenticated using (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'));
create policy "admin delete product images" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'));
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
    raise exception 'Quantidade invÃ¡lida';
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
    raise exception 'Conta de revendedor nÃ£o encontrada';
  end if;
  if _reseller.status <> 'active' then
    raise exception 'Conta de revendedor suspensa ou inativa';
  end if;

  -- Lock and validate product
  select * into _prod from products where id = _product_id and active for update;
  if not found then
    raise exception 'Produto indisponÃ­vel ou inexistente';
  end if;

  if _prod.stock is not null and _prod.stock < _quantity then
    raise exception 'Estoque insuficiente no momento';
  end if;

  -- Get B2B cost price
  select price, is_b2b_available into _unit_price, _is_avail
  from b2b_get_product_price(_product_id, _reseller_id);

  if not _is_avail then
    raise exception 'Produto nÃ£o estÃ¡ habilitado para revenda B2B';
  end if;

  _total := round(_unit_price * _quantity, 2);

  -- Lock wallet
  select * into _wallet from wallets where user_id = _reseller.user_id for update;
  if not found then
    insert into wallets(user_id, balance) values (_reseller.user_id, 0)
    returning * into _wallet;
  end if;

  if _wallet.balance < _total then
    raise exception 'Saldo insuficiente na carteira B2B (Saldo: R$ %, NecessÃ¡rio: R$ %)', _wallet.balance, _total;
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
    raise exception 'DepÃ³sito nÃ£o encontrado';
  end if;
  if _dep.status = 'paid' then
    return; -- already credited
  end if;

  select * into _reseller from reseller_accounts where id = _dep.reseller_id;
  if not found then
    raise exception 'Revendedor nÃ£o encontrado';
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
    'Recarga PIX B2B - DepÃ³sito ' || substr(_dep.id::text, 1, 8)
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
    raise exception 'SolicitaÃ§Ã£o de reembolso nÃ£o encontrada';
  end if;
  if _req.status <> 'pending' then
    raise exception 'SolicitaÃ§Ã£o jÃ¡ processada anteriormente';
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
