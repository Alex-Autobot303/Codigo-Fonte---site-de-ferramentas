import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/catalog";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — NexaTools" },
      { name: "description", content: "Termos e condições de uso da loja." },
      { property: "og:title", content: "Termos de uso — NexaTools" },
      { property: "og:description", content: "Termos e condições de uso." },
    ],
  }),
  component: () => {
    const { data } = useQuery(settingsQuery());
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold">Termos de uso</h1>
        <p className="mt-6 whitespace-pre-line text-muted-foreground">
          {data?.terms || "Os termos de uso ainda não foram publicados pela loja. O administrador pode editá-los em Painel administrativo → Configurações."}
        </p>
      </div>
    );
  },
});
