# Changelog

## [0.2.0] - 2026-11-01

### Adicionado

- US007 (#21): seleção dos horizontes de 7, 15 e 30 dias, compartilhada pelo cartão e
  gráfico, com URL persistente e versões de modelo independentes.
- US008 (#22): intervalo nominal de 80%, calibração temporal separada, avaliação de
  cobertura e aviso “Incerteza elevada”. A faixa aparece no gráfico existente.
- Exibição simplificada da taxa de confiança nominal no cartão, com data-base, data-alvo
  e janela da média futura identificadas. Cobertura de teste permanece nos relatórios e API.
- Migração aditiva, contrato OpenAPI, testes de ML, API, gráfico e integração por horizonte.

### Alterado

- O treino mantém o modelo avaliado, sem retreino sobre calibração/teste.
- Modelos antigos mantêm previsão pontual e informam intervalo indisponível.
- A API aceita exatamente 7, 15 e 30 dias. A preparação operacional está em
  [docs/ml-integracao.md](docs/ml-integracao.md).
