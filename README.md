# Maintenance Hub — Checklist Insights (Ar-Condicionado)

Painel para gestão dos **Checklists de Ar-Condicionado** realizados nas lojas.

## Pré-requisitos

- **Node.js** v18+ — https://nodejs.org
- ou **Bun** — https://bun.sh

## Instalação e execução local

```bash
# Instalar dependências
npm install
# ou: bun install

# Rodar em desenvolvimento
npm run dev
# ou: bun dev
```

Acesse: http://localhost:5173

## Build para produção (Netlify)

```bash
npm run build
# ou: bun run build
```

O output fica em `dist/`. O arquivo `netlify.toml` já está configurado para SPA.

## Variáveis de ambiente

O arquivo `.env` já está preenchido com as chaves do projeto.
Para Netlify, adicione as variáveis em **Site Settings → Environment Variables**:

```
VITE_CHECKLIST_SUPABASE_URL=
VITE_CHECKLIST_SUPABASE_PUBLISHABLE_KEY=
```

> ⚠️ Nunca use `service_role` keys no frontend.

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Dashboard Geral consolidado |
| `/checklist` | Dashboard de Checklists de AC |
| `/checklist/checklists` | Listagem de checklists |
| `/checklist/lojas` | Lojas avaliadas |
| `/checklist/tecnicos` | Análise por técnico |
| `/checklist/importacoes` | Log de importações |
| `/lojas/:id` | Visão unificada por loja |
| `/configuracoes` | Configurações |

## Tecnologias

- React 19 + TypeScript
- Vite 6
- Tailwind CSS v4
- shadcn/ui (Radix UI)
- React Router v6
- @tanstack/react-query
- Recharts
- Supabase JS

## Estrutura

```
src/
├── integrations/
│   └── checklist/client.ts     ← Supabase Checklist
├── shared/
│   ├── components/             ← Layout, Sidebar, StatCard, UI
│   └── utils/                  ← format, storeUtils, exportCsv
├── modules/
│   └── checklist/              ← Hooks + páginas do módulo AC
└── pages/                      ← Dashboard Geral, LojaDetalhe, Config, Mapa
```
