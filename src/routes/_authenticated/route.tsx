import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        throw redirect({ to: "/auth", search: { redirect: location.href } });
      }
    } catch (e: any) {
      if (e?.to || e?.isRedirect || e?.status) throw e;
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
