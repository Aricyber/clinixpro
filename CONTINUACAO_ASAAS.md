# Continuação da assinatura SaaS com Asaas

Última atualização: 29/09/2026

## Decisões definidas

- Gateway: Asaas.
- Plano: R$ 99,90 por clínica/mês.
- Teste gratuito: 14 dias.
- Tolerância após o vencimento: 10 dias.
- Bloqueio automático: no 11º dia sem pagamento.
- Formas de pagamento: cartão, Pix e boleto.
- Apenas o proprietário da clínica pode contratar ou regularizar a assinatura.

## O que já foi implementado

- Tela `/billing` para contratação e regularização.
- Criação de cliente e assinatura mensal no Asaas.
- Primeira cobrança programada para o fim do período gratuito.
- Webhook autenticado para confirmar pagamentos, registrar atrasos e cancelar acesso.
- Processamento idempotente para não executar duas vezes o mesmo evento.
- Liberação automática após pagamento confirmado.
- Período de tolerância de 10 dias para pagamento vencido.
- Bloqueio na interface e também no banco por políticas RLS.
- Proteção dos campos da assinatura contra alteração pelo navegador.
- Variáveis de ambiente e instruções adicionadas ao README.

## Validações realizadas

- 20 testes automatizados aprovados.
- ESLint aprovado.
- Build de produção aprovado.
- `/billing` respondeu HTTP 200.
- APIs de assinatura e webhook recusaram chamadas não autenticadas com HTTP 401.

## Próximos passos para ativação real

1. Executar no Supabase a migração `supabase/migrations/202609290001_saas_subscriptions.sql`.
2. Criar/testar uma conta Sandbox no Asaas.
3. Configurar no ambiente do servidor, sem compartilhar em mensagens:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ASAAS_ENVIRONMENT=sandbox`
   - `ASAAS_API_KEY`
   - `ASAAS_WEBHOOK_TOKEN`
4. Cadastrar no Asaas o endpoint `https://SEU-DOMINIO/api/webhooks/asaas`.
5. Habilitar entrega sequencial e os eventos documentados no README.
6. Fazer um pagamento completo no Sandbox e conferir liberação, atraso, tolerância e bloqueio.
7. Depois dos testes, trocar o ambiente e a chave para produção.

## Observação de segurança

Nunca colocar chaves do Supabase ou Asaas no código, no navegador ou em variáveis com prefixo `NEXT_PUBLIC_`. Nenhuma chave secreta está registrada neste arquivo.
