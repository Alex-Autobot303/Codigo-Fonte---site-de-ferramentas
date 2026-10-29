import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/catalog";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade (LGPD) — NexaTools" },
      { name: "description", content: "Como tratamos seus dados pessoais conforme a LGPD." },
      { property: "og:title", content: "Política de privacidade — NexaTools" },
      { property: "og:description", content: "Tratamento de dados pessoais conforme a LGPD." },
    ],
  }),
  component: () => {
    const { data } = useQuery(settingsQuery());
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">Política de privacidade</h1>
        <p className="mt-6 whitespace-pre-line text-muted-foreground">
          {data?.privacy_policy ||
            "Coletamos apenas os dados necessários para processar pedidos, entregar produtos e prestar suporte (nome, e-mail e histórico de compras). Você pode solicitar acesso, correção ou exclusão dos seus dados pela central de suporte. O texto completo será publicado pelo administrador da loja."}
        </p>
      </div>
    );
  },
});
