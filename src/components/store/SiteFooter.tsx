import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { Logo } from "./SiteHeader";
import { categoriesQuery, settingsQuery } from "@/lib/catalog";

export function SiteFooter() {
  const { data: s } = useQuery(settingsQuery());
  const { data: cats } = useQuery(categoriesQuery());
  const wa = s?.whatsapp?.replace(/\D/g, "");
  return (
    <footer className="mt-24 border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="space-y-3">
          <Logo name={s?.store_name} />
          <p className="text-sm text-muted-foreground">
            Ferramentas digitais de automação, IA e marketing para o seu negócio.
          </p>
          {s?.support_email && <p className="text-sm text-muted-foreground">{s.support_email}</p>}
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Categorias</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {cats?.map((c) => (
              <li key={c.id}>
                <Link to="/produtos" search={{ categoria: c.slug }} className="hover:text-primary">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Minha conta</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/conta" className="hover:text-primary">
                Painel
              </Link>
            </li>
            <li>
              <Link to="/conta/pedidos" className="hover:text-primary">
                Meus pedidos
              </Link>
            </li>
            <li>
              <Link to="/conta/carteira" className="hover:text-primary">
                Carteira
              </Link>
            </li>
            <li>
              <Link to="/conta/suporte" className="hover:text-primary">
                Suporte
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Institucional & B2B</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/developers" className="text-violet font-medium hover:text-primary">
                API B2B (Revenda)
              </Link>
            </li>
            <li>
              <Link to="/developers/docs" className="hover:text-primary">
                Documentação da API
              </Link>
            </li>
            <li>
              <Link to="/revendedor" className="hover:text-primary">
                Painel do Revendedor
              </Link>
            </li>
            <li>
              <Link to="/termos" className="hover:text-primary">
                Termos de uso
              </Link>
            </li>
            <li>
              <Link to="/privacidade" className="hover:text-primary">
                Política de privacidade (LGPD)
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {s?.store_name ?? "NexaTools"}. {s?.company_info}
      </div>
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp"
          className="fixed bottom-5 right-5 z-50 grid h-14 w-14 place-items-center rounded-full bg-success text-primary-foreground shadow-glow transition hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      )}
    </footer>
  );
}
