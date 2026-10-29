export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json | null;
          id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          id?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          description: string | null;
          icon: string | null;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          description?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          description?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          discount_type: string;
          expires_at: string | null;
          id: string;
          max_uses: number | null;
          min_total: number;
          per_user_limit: number | null;
          used_count: number;
          value: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          discount_type: string;
          expires_at?: string | null;
          id?: string;
          max_uses?: number | null;
          min_total?: number;
          per_user_limit?: number | null;
          used_count?: number;
          value: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          discount_type?: string;
          expires_at?: string | null;
          id?: string;
          max_uses?: number | null;
          min_total?: number;
          per_user_limit?: number | null;
          used_count?: number;
          value?: number;
        };
        Relationships: [];
      };
      deliveries: {
        Row: {
          admin_note: string | null;
          content: string | null;
          created_at: string;
          delivered_at: string | null;
          delivery_type: Database["public"]["Enums"]["delivery_type"];
          id: string;
          order_id: string;
          order_item_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          admin_note?: string | null;
          content?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          delivery_type: Database["public"]["Enums"]["delivery_type"];
          id?: string;
          order_id: string;
          order_item_id: string;
          status?: string;
          user_id: string;
        };
        Update: {
          admin_note?: string | null;
          content?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          delivery_type?: Database["public"]["Enums"]["delivery_type"];
          id?: string;
          order_id?: string;
          order_item_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deliveries_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: true;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string;
          product_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          product_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          product_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          coupon_id: string | null;
          created_at: string;
          discount: number;
          id: string;
          number: number;
          paid_at: string | null;
          payment_method: string | null;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          total: number;
          user_id: string;
        };
        Insert: {
          coupon_id?: string | null;
          created_at?: string;
          discount?: number;
          id?: string;
          number?: number;
          paid_at?: string | null;
          payment_method?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          total: number;
          user_id: string;
        };
        Update: {
          coupon_id?: string | null;
          created_at?: string;
          discount?: number;
          id?: string;
          number?: number;
          paid_at?: string | null;
          payment_method?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal?: number;
          total?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey";
            columns: ["coupon_id"];
            isOneToOne: false;
            referencedRelation: "coupons";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          order_id: string | null;
          provider: string;
          provider_payment_id: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          order_id?: string | null;
          provider: string;
          provider_payment_id?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          order_id?: string | null;
          provider?: string;
          provider_payment_id?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      product_files: {
        Row: {
          file_url: string;
          product_id: string;
          updated_at: string;
        };
        Insert: {
          file_url: string;
          product_id: string;
          updated_at?: string;
        };
        Update: {
          file_url?: string;
          product_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_files_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_licenses: {
        Row: {
          created_at: string;
          delivered_at: string | null;
          id: string;
          license_key: string;
          order_item_id: string | null;
          product_id: string;
        };
        Insert: {
          created_at?: string;
          delivered_at?: string | null;
          id?: string;
          license_key: string;
          order_item_id?: string | null;
          product_id: string;
        };
        Update: {
          created_at?: string;
          delivered_at?: string | null;
          id?: string;
          license_key?: string;
          order_item_id?: string | null;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_licenses_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          active: boolean;
          benefits: string[];
          bestseller: boolean;
          category_id: string | null;
          created_at: string;
          delivery_file_url: string | null;
          delivery_info: string | null;
          delivery_type: Database["public"]["Enums"]["delivery_type"];
          demo_price: boolean;
          description: string | null;
          featured: boolean;
          features: string[];
          id: string;
          image_url: string | null;
          is_new: boolean;
          name: string;
          price: number;
          promo_ends_at: string | null;
          promo_price: number | null;
          sales_count: number;
          short_description: string | null;
          slug: string;
          stock: number | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          benefits?: string[];
          bestseller?: boolean;
          category_id?: string | null;
          created_at?: string;
          delivery_file_url?: string | null;
          delivery_info?: string | null;
          delivery_type?: Database["public"]["Enums"]["delivery_type"];
          demo_price?: boolean;
          description?: string | null;
          featured?: boolean;
          features?: string[];
          id?: string;
          image_url?: string | null;
          is_new?: boolean;
          name: string;
          price: number;
          promo_ends_at?: string | null;
          promo_price?: number | null;
          sales_count?: number;
          short_description?: string | null;
          slug: string;
          stock?: number | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          benefits?: string[];
          bestseller?: boolean;
          category_id?: string | null;
          created_at?: string;
          delivery_file_url?: string | null;
          delivery_info?: string | null;
          delivery_type?: Database["public"]["Enums"]["delivery_type"];
          demo_price?: boolean;
          description?: string | null;
          featured?: boolean;
          features?: string[];
          id?: string;
          image_url?: string | null;
          is_new?: boolean;
          name?: string;
          price?: number;
          promo_ends_at?: string | null;
          promo_price?: number | null;
          sales_count?: number;
          short_description?: string | null;
          slug?: string;
          stock?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      store_settings: {
        Row: {
          company_info: string | null;
          id: number;
          instagram: string | null;
          privacy_policy: string | null;
          store_name: string;
          support_email: string | null;
          terms: string | null;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          company_info?: string | null;
          id?: number;
          instagram?: string | null;
          privacy_policy?: string | null;
          store_name?: string;
          support_email?: string | null;
          terms?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          company_info?: string | null;
          id?: number;
          instagram?: string | null;
          privacy_policy?: string | null;
          store_name?: string;
          support_email?: string | null;
          terms?: string | null;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      support_messages: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          is_staff: boolean;
          ticket_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          is_staff?: boolean;
          ticket_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          is_staff?: boolean;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "support_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      support_tickets: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          order_id: string | null;
          protocol: string;
          status: string;
          subject: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          order_id?: string | null;
          protocol?: string;
          status?: string;
          subject: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          order_id?: string | null;
          protocol?: string;
          status?: string;
          subject?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          amount: number;
          created_at: string;
          description: string | null;
          id: string;
          kind: string;
          order_id: string | null;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind: string;
          order_id?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          kind?: string;
          order_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          balance: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_adjust_wallet: {
        Args: { _amount: number; _note: string; _user: string };
        Returns: undefined;
      };
      admin_cancel_order: {
        Args: { _order: string; _refund?: boolean };
        Returns: undefined;
      };
      admin_confirm_payment: {
        Args: { _note?: string; _order: string };
        Returns: undefined;
      };
      admin_deliver_manual: {
        Args: { _content: string; _delivery: string };
        Returns: undefined;
      };
      create_order: {
        Args: { _coupon?: string; _items: Json };
        Returns: string;
      };
      finalize_paid_order: { Args: { _order: string }; Returns: undefined };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      pay_order_with_wallet: { Args: { _order: string }; Returns: undefined };
    };
    Enums: {
      app_role: "admin" | "user";
      delivery_type: "licenca" | "arquivo" | "manual";
      order_status: "pendente" | "pago" | "entregue" | "cancelado" | "reembolsado";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      delivery_type: ["licenca", "arquivo", "manual"],
      order_status: ["pendente", "pago", "entregue", "cancelado", "reembolsado"],
    },
  },
} as const;
