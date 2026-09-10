# Arquitetura do Skinomics

## 1. Visão geral

O Skinomics é uma plataforma web de previsão de preços de itens da Steam.

A arquitetura será organizada em componentes com responsabilidades separadas,
permitindo que coleta de dados, armazenamento, processamento, Machine Learning
e interface evoluam de forma independente.

O projeto seguirá um modelo incremental, dividido em quatro incrementos:

1. Fundação de Dados
2. Consulta e Navegação
3. Inteligência
4. Conclusão

## 2. Componentes principais

### 2.1 Frontend

Responsável pela interface utilizada pelo usuário.

Principais funcionalidades:

- Autenticação com a Steam;
- Onboarding de preferências;
- Painel do mercado;
- Busca e filtros de itens;
- Detalhes dos itens;
- Previsões de preço;
- Comparação de itens;
- Inventário;
- Itens acompanhados;
- Alertas;
- Ranking de oportunidades;
- Detecção de movimentos atípicos;
- Conta e preferências.

### 2.2 Backend

Responsável pela lógica da aplicação e pela comunicação entre o frontend,
banco de dados, coletores e modelos de Machine Learning.

Principais responsabilidades:

- Gerenciamento de usuários e sessões;
- Autenticação com a Steam;
- Disponibilização da API;
- Consulta e processamento dos dados;
- Gerenciamento de itens acompanhados;
- Gerenciamento de alertas;
- Cálculo de indicadores;
- Comunicação com os modelos de Machine Learning;
- Geração de rankings e oportunidades.

### 2.3 Coletores de dados

Responsáveis pela obtenção periódica de informações da Steam.

Principais responsabilidades:

- Coleta do catálogo de itens;
- Coleta de preços e volume;
- Execução periódica das coletas;
- Registro das execuções;
- Registro de novos itens;
- Registro de falhas;
- Reprocessamento de coletas que falharam.

A arquitetura deverá considerar limites de requisição, tentativas novamente
em caso de falha e mecanismos para reduzir o risco de bloqueio.

### 2.4 Banco de dados

Responsável pelo armazenamento dos dados utilizados pelo sistema.

Entre os principais dados estão:

- Usuários;
- Itens;
- Preços;
- Volume;
- Séries históricas;
- Preferências;
- Itens acompanhados;
- Alertas;
- Previsões;
- Informações relacionadas aos modelos.

O banco deverá possuir mecanismos de migração, normalização, deduplicação,
backup e restauração.

### 2.5 Machine Learning

Responsável pela análise dos dados históricos e pela geração de previsões.

O desenvolvimento seguirá inicialmente um modelo baseline, que servirá como
referência para avaliação dos modelos posteriores.

Principais responsabilidades:

- Preparação dos conjuntos de treino, validação e teste;
- Engenharia de atributos;
- Treinamento dos modelos;
- Avaliação das métricas;
- Versionamento dos modelos;
- Registro das métricas de cada versão;
- Seleção do modelo ativo;
- Retreinamento periódico.

As previsões deverão considerar horizontes de 7 a 30 dias, intervalo de
confiança e métricas de erro.

### 2.6 Testes

Os testes serão realizados durante o desenvolvimento dos componentes e a
integração dos incrementos.

Serão considerados:

- Testes funcionais;
- Testes de integração;
- Testes de regressão;
- Testes de desempenho;
- Testes de usabilidade;
- Validação dos modelos de Machine Learning.

## 3. Fluxo geral dos dados

O fluxo principal esperado é:

Steam
↓
Coletores de dados
↓
Banco de dados
↓
Processamento dos dados
↓
Machine Learning
↓
Previsões e análises
↓
Backend / API
↓
Frontend
↓
Usuário

Algumas funcionalidades também utilizarão diretamente os dados armazenados,
como busca, filtros, histórico de preços, inventário e indicadores do mercado.

## 4. Integração entre componentes

As principais fronteiras arquiteturais serão:

- Coleta de dados;
- Armazenamento;
- Modelo preditivo;
- Interface.

O backend atuará como camada de integração entre a interface e os serviços
necessários para o funcionamento da aplicação.

As interfaces de comunicação entre os componentes deverão ser documentadas
conforme a implementação evoluir.

## 5. Arquitetura incremental

A arquitetura será desenvolvida e validada progressivamente conforme os
quatro incrementos do projeto.

### Incremento 1 — Fundação de Dados

Prioridade:

- Coletores de dados;
- Banco de dados histórico;
- Agendamento das coletas;
- Monitoramento das coletas;
- Base inicial de autenticação.

### Incremento 2 — Consulta e Navegação

Prioridade:

- Autenticação com a Steam;
- Onboarding;
- Painel do mercado;
- Busca e filtros;
- Detalhes dos itens;
- Itens acompanhados.

### Incremento 3 — Inteligência

Prioridade:

- Previsão de preços;
- Comparação de itens;
- Ranking de oportunidades;
- Detecção de movimentos atípicos;
- Gestão dos modelos de Machine Learning.

### Incremento 4 — Conclusão

Prioridade:

- Inventário;
- Alertas;
- Conta e preferências;
- Exportação de dados;
- Evolução e retreinamento dos modelos.

## 6. Princípios

- Separação de responsabilidades entre os componentes;
- Desenvolvimento incremental;
- Testes durante cada incremento;
- Versionamento do código e dos modelos;
- Integração contínua entre os componentes;
- Documentação das decisões arquiteturais;
- Validação dos componentes antes da integração.