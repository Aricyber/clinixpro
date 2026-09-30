# ClinixPro

SaaS moderno para gestão de clínicas odontológicas e fisioterapêuticas.

## Visão geral

ClinixPro é uma aplicação multiempresa para gestão de clínicas, com foco em segurança, isolamento de dados por clínica, UX e operação eficiente.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Zod
- Vercel-ready

## Requisitos

- Node.js 20+
- npm
- Conta Supabase

## Instalação

```bash
npm install
cp .env.example .env.local
```

## Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_NAME=ClinixPro
NEXT_PUBLIC_APP_ENV=development
ASAAS_ENVIRONMENT=sandbox
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
```

Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`.
Nunca use `SUPABASE_SERVICE_ROLE_KEY` no navegador ou em variáveis com prefixo `NEXT_PUBLIC_`.

## Assinatura SaaS com Asaas

O plano padrão custa R$ 99,90 por clínica/mês, com 14 dias gratuitos e 10 dias de tolerância após o vencimento. O proprietário cria a assinatura pela tela `/billing`; o Asaas oferece cartão, Pix ou boleto na cobrança e os webhooks liberam ou suspendem o acesso automaticamente.

1. Crie primeiro uma conta no Sandbox do Asaas e copie a chave de API para `ASAAS_API_KEY`.
2. Gere um token longo e aleatório para `ASAAS_WEBHOOK_TOKEN`.
3. No Asaas, cadastre o webhook `https://SEU-DOMINIO/api/webhooks/asaas`, informe o mesmo token e ative o envio sequencial.
4. Selecione os eventos `PAYMENT_CREATED`, `PAYMENT_UPDATED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`, `PAYMENT_CHARGEBACK_REQUESTED`, `SUBSCRIPTION_INACTIVATED` e `SUBSCRIPTION_DELETED`.
5. Valide o fluxo no Sandbox antes de trocar `ASAAS_ENVIRONMENT` para `production` e usar a chave de produção.

`SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` são segredos exclusivos do servidor. Configure-os também no ambiente de hospedagem e nunca use o prefixo `NEXT_PUBLIC_` neles.

## Preparar o banco Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor do projeto e execute, em ordem, os arquivos de `supabase/migrations/`.
3. Configure as variáveis públicas do Supabase no `.env.local` e reinicie o servidor.
4. O provisionamento inicial da clínica deve ser feito pelo usuário autenticado usando a função `create_clinic_for_current_user`.

A migração cria as tabelas multiempresa, vínculos por clínica e políticas RLS. Aplicá-la não conecta automaticamente as telas: os dados e formulários atuais ainda usam mocks e estado local. Não use dados reais de pacientes até concluir a integração das telas e validar o fluxo de autenticação e as políticas no projeto Supabase.

## Execução local

```bash
npm run dev
```

Acesse http://localhost:3000.

## Testes

Com o servidor local em execução, use:

```bash
npm test
npm run test:smoke
```

O primeiro comando valida as regras de negócio. O smoke test verifica todas as rotas,
a existência das tabelas no Supabase e se o RLS impede leitura anônima dos dados.

## Estrutura principal

```bash
src/
  app/
  components/
  lib/
  schemas/
  types/
```

## MVP implementado

- autenticação visual de acesso
- dashboard inicial
- pacientes
- profissionais
- serviços
- agenda
- prontuários
- financeiro
- configurações
- layout responsivo
- identidade visual do produto

## Observações importantes

- O projeto está preparado para evoluir para arquitetura multi-tenant com RLS em Supabase.
- Dados sensíveis devem permanecer no backend e não devem ser expostos em logs.
- As credenciais do Supabase devem ser configuradas via variáveis de ambiente locais.

## Próximos passos recomendados

1. Aplicar e validar a migração inicial no projeto Supabase.
2. Implementar onboarding da clínica e carregar o perfil real após login.
3. Conectar cada CRUD ao banco e remover o estado/mocks de demonstração.
4. Testar isolamento entre clínicas e permissões com usuários de cada papel.
