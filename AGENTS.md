<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Architecture rules

- Money-moving logic (order creation, wallet payment, refunds, license assignment) lives in SECURITY DEFINER SQL functions; clients only call RPCs so prices and balances are never trusted from the browser.
- Product download links live in admin-only `product_files`; `products.delivery_file_url` is deprecated and forced null.
- First user to sign up becomes admin (signup trigger); further admins are added via `user_roles`.
