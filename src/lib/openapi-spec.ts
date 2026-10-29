export const openApiSpecification = {
  openapi: "3.1.0",
  info: {
    title: "NexaTools B2B Reseller REST API",
    version: "1.0.0",
    description:
      "API REST B2B profissional para revenda de produtos digitais, licenças e automações. Permite integração com bots de Telegram/WhatsApp, plataformas SaaS, lojas virtuais e aplicativos.",
    contact: {
      name: "Suporte ao Desenvolvedor B2B",
      email: "suporte@nexatools.com",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "Servidor Principal (v1)",
    },
  ],
  security: [
    {
      BearerAuth: [],
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "API Key (ak_live_...)",
        description: "Envie sua chave secreta no cabeçalho Authorization: Bearer ak_live_xxxxxxxx",
      },
      IdempotencyHeader: {
        type: "apiKey",
        in: "header",
        name: "Idempotency-Key",
        description: "Identificador único da requisição (ex: UUID) para evitar cobranças duplicadas em pedidos.",
      },
    },
    schemas: {
      StandardResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: { type: "object" },
          error: { type: "string" },
        },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid", example: "96d747f5-fd4d-49ff-a1b7-a8a25c1b6942" },
          name: { type: "string", example: "Bulk Button Pro" },
          slug: { type: "string", example: "bulk-button-pro" },
          category: { type: "string", example: "Automação WhatsApp" },
          category_slug: { type: "string", example: "automacao-whatsapp" },
          price: { type: "number", format: "float", example: 45.0 },
          currency: { type: "string", example: "BRL" },
          available: { type: "boolean", example: true },
          stock: { type: "integer", nullable: true, example: 50 },
          delivery_type: { type: "string", enum: ["licenca", "arquivo", "manual"], example: "licenca" },
          short_description: { type: "string", example: "Ferramenta de automação e envio" },
        },
      },
      Category: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Automação WhatsApp" },
          slug: { type: "string", example: "automacao-whatsapp" },
          description: { type: "string" },
        },
      },
      Wallet: {
        type: "object",
        properties: {
          balance: { type: "number", format: "float", example: 250.0 },
          currency: { type: "string", example: "BRL" },
          reseller_id: { type: "string", format: "uuid" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      WalletTransaction: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          amount: { type: "number", format: "float", example: -45.0 },
          kind: { type: "string", enum: ["recarga", "compra", "reembolso", "ajuste"], example: "compra" },
          description: { type: "string", example: "Compra B2B API - Pedido #1024" },
          order_id: { type: "string", format: "uuid", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      OrderRequest: {
        type: "object",
        required: ["product_id", "quantity"],
        properties: {
          product_id: { type: "string", format: "uuid", example: "96d747f5-fd4d-49ff-a1b7-a8a25c1b6942" },
          quantity: { type: "integer", minimum: 1, maximum: 50, example: 1 },
          external_order_id: { type: "string", example: "meu_bot_telegram_#9841" },
        },
      },
      OrderResponse: {
        type: "object",
        properties: {
          order_id: { type: "string", example: "ORD-1025" },
          internal_id: { type: "string", format: "uuid" },
          external_order_id: { type: "string", example: "meu_bot_telegram_#9841" },
          product_id: { type: "string", format: "uuid" },
          product_name: { type: "string", example: "Bulk Button Pro" },
          quantity: { type: "integer", example: 1 },
          unit_price: { type: "number", format: "float", example: 45.0 },
          amount: { type: "number", format: "float", example: 45.0 },
          currency: { type: "string", example: "BRL" },
          status: { type: "string", example: "completed" },
          delivery_status: { type: "string", enum: ["completed", "pending", "failed"], example: "completed" },
          delivery_type: { type: "string", example: "licenca" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      DeliveryDetail: {
        type: "object",
        properties: {
          order_id: { type: "string", example: "ORD-1025" },
          delivery_type: { type: "string", example: "licenca" },
          status: { type: "string", enum: ["aguardando", "entregue", "problema"], example: "entregue" },
          content: { type: "string", example: "LICENSE-KEY-XXXX-YYYY-ZZZZ" },
          download_url: { type: "string", nullable: true, example: "https://nexatools.com/download/temp-token-123" },
          instructions: { type: "string", example: "Instale o executável e ative a licença fornecida." },
          delivered_at: { type: "string", format: "date-time" },
        },
      },
      DepositRequest: {
        type: "object",
        required: ["amount"],
        properties: {
          amount: { type: "number", minimum: 1, example: 100.0 },
        },
      },
      DepositResponse: {
        type: "object",
        properties: {
          deposit_id: { type: "string", format: "uuid" },
          amount: { type: "number", example: 100.0 },
          status: { type: "string", enum: ["pending", "paid"], example: "pending" },
          pix_code: { type: "string", example: "00020126580014br.gov.bcb.pix0136..." },
          pix_qr_url: { type: "string", example: "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=..." },
          created_at: { type: "string", format: "date-time" },
        },
      },
      RefundRequestInput: {
        type: "object",
        required: ["reason"],
        properties: {
          reason: { type: "string", example: "Cliente final relatou incompatibilidade com sistema operacional." },
        },
      },
    },
  },
  paths: {
    "/products": {
      get: {
        summary: "Catálogo de Produtos para Revenda",
        description: "Retorna a lista completa de produtos digitais com os preços de custo B2B aplicáveis à sua conta.",
        tags: ["Produtos"],
        responses: {
          "200": {
            description: "Catálogo retornado com sucesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Product" },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "API Key não informada ou inválida" },
          "429": { description: "Limite de requisições excedido" },
        },
      },
    },
    "/products/{id}": {
      get: {
        summary: "Detalhes de um Produto",
        tags: ["Produtos"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "ID ou slug do produto" },
        ],
        responses: {
          "200": {
            description: "Detalhes do produto",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/Product" },
                  },
                },
              },
            },
          },
          "404": { description: "Produto não encontrado" },
        },
      },
    },
    "/categories": {
      get: {
        summary: "Listar Categorias",
        tags: ["Produtos"],
        responses: {
          "200": {
            description: "Lista de categorias",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Category" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/products/{id}/stock": {
      get: {
        summary: "Consultar Estoque",
        tags: ["Produtos"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Disponibilidade de estoque",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        product_id: { type: "string" },
                        available: { type: "boolean", example: true },
                        stock: { type: "integer", nullable: true, example: 34 },
                        delivery_type: { type: "string", example: "licenca" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/products/{id}/price": {
      get: {
        summary: "Consultar Preço de Custo do Revendedor",
        tags: ["Produtos"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Preço de revenda específico",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        product_id: { type: "string" },
                        price: { type: "number", example: 35.0 },
                        currency: { type: "string", example: "BRL" },
                        available: { type: "boolean", example: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/wallet": {
      get: {
        summary: "Consultar Saldo da Carteira",
        tags: ["Carteira & Pagamentos"],
        responses: {
          "200": {
            description: "Saldo atual do revendedor",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/Wallet" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/wallet/transactions": {
      get: {
        summary: "Extrato de Movimentações",
        tags: ["Carteira & Pagamentos"],
        responses: {
          "200": {
            description: "Histórico de compras, recargas e reembolsos",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/WalletTransaction" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/wallet/deposits": {
      post: {
        summary: "Criar Solicitação de Recarga (PIX)",
        tags: ["Carteira & Pagamentos"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DepositRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Cobrança PIX gerada com sucesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/DepositResponse" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/wallet/deposits/{id}": {
      get: {
        summary: "Consultar Status de Recarga PIX",
        tags: ["Carteira & Pagamentos"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Status da recarga",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/DepositResponse" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/orders": {
      get: {
        summary: "Listar Pedidos do Revendedor",
        tags: ["Compras & Pedidos"],
        responses: {
          "200": {
            description: "Lista de pedidos realizados via API",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/OrderResponse" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Comprar Produto via API (Débito em Carteira)",
        description: "Executa a compra imediata com débito atômico na carteira do revendedor e entrega digital instantânea.",
        tags: ["Compras & Pedidos"],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string" },
            description: "Chave única de idempotência para evitar cobranças duplicadas",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OrderRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Pedido criado e entregue com sucesso",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/OrderResponse" },
                  },
                },
              },
            },
          },
          "400": { description: "Saldo insuficiente ou produto indisponível" },
          "409": { description: "Requisição duplicada já processada" },
        },
      },
    },
    "/orders/{id}": {
      get: {
        summary: "Consultar Detalhes do Pedido",
        tags: ["Compras & Pedidos"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Detalhes do pedido",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/OrderResponse" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/orders/{id}/delivery": {
      get: {
        summary: "Consultar Entrega do Pedido (Licenças/Downloads)",
        tags: ["Compras & Pedidos"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Dados de entrega digital",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: { $ref: "#/components/schemas/DeliveryDetail" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/orders/{id}/refund-requests": {
      post: {
        summary: "Solicitar Reembolso de um Pedido",
        tags: ["Compras & Pedidos"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefundRequestInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Solicitação de reembolso enviada para análise",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        refund_id: { type: "string" },
                        order_id: { type: "string" },
                        status: { type: "string", example: "pending" },
                        message: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/webhooks": {
      get: {
        summary: "Consultar Configuração de Webhook",
        tags: ["Webhooks"],
        responses: {
          "200": {
            description: "Configuração atual do webhook",
          },
        },
      },
      post: {
        summary: "Cadastrar ou Atualizar Webhook",
        tags: ["Webhooks"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: {
                  url: { type: "string", format: "uri", example: "https://meubot.com/webhook/nexatools" },
                  secret: { type: "string", example: "whsec_custom_secret_key" },
                  events: {
                    type: "array",
                    items: { type: "string" },
                    example: ["order.created", "order.completed", "delivery.completed", "wallet.deposit.completed"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Webhook salvo com sucesso" },
          "400": { description: "URL inválida ou insegura (bloqueio SSRF)" },
        },
      },
    },
    "/webhooks/test": {
      post: {
        summary: "Disparar Webhook de Teste com Assinatura HMAC",
        tags: ["Webhooks"],
        responses: {
          "200": {
            description: "Resultado do envio de teste",
          },
        },
      },
    },
  },
};
