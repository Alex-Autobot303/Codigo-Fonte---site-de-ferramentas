import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { dateBR, errMsg } from "@/lib/format";

export function TicketThread({ ticketId, staff = false }: { ticketId: string; staff?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["ticket-msgs", ticketId],
    queryFn: async () =>
      (
        await supabase
          .from("support_messages")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("created_at")
      ).data ?? [],
  });
  const send = async () => {
    if (!body.trim() || !user) return;
    try {
      await supabase
        .from("support_messages")
        .insert({ ticket_id: ticketId, author_id: user.id, is_staff: staff, body: body.trim() })
        .throwOnError();
      if (staff)
        await supabase
          .from("support_tickets")
          .update({ status: "respondido", updated_at: new Date().toISOString() })
          .eq("id", ticketId)
          .throwOnError();
      setBody("");
      qc.invalidateQueries({ queryKey: ["ticket-msgs", ticketId] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <div className="space-y-3">
      {data.map((m) => (
        <div
          key={m.id}
          className={`max-w-[85%] rounded-2xl p-3 text-sm ${m.is_staff ? "bg-primary/15" : "ml-auto bg-card border border-border"}`}
        >
          <div className="mb-1 text-xs text-muted-foreground">
            {m.is_staff ? "Equipe de suporte" : "Cliente"} · {dateBR(m.created_at)}
          </div>
          <div className="whitespace-pre-line">{m.body}</div>
        </div>
      ))}
      <div className="flex gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva uma mensagem..."
          maxLength={5000}
        />
        <Button variant="hero" onClick={send}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
