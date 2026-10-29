
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
  if _o.status <> 'pago' then raise exception 'Pedido não está pago'; end if;
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
            values (_i.id, _order, _o.user_id, 'licenca', 'problema', 'Sem licenças disponíveis em estoque');
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
