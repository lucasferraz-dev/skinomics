# Coleta diária automática

A coleta baixa da Steam os preços dos itens acompanhados (`backend/app/coleta/itens_tf2.txt`) e, logo
depois, publica as previsões novas e confere os alertas de preço dos usuários (quem tiver um alerta
disparado vê o sino do site ficar verde). Ela roda sozinha no PC do Lucas, pelo Agendador de Tarefas do
Windows, e não precisa de ninguém no dia a dia: só quando o cookie da Steam vence.

## Quando ela roda

A tarefa se chama **Skinomics - coleta diaria** e dispara em dois momentos: 3 minutos depois de
entrar no Windows e às 3h da manhã. O horário da madrugada só vale se o PC estiver ligado ou em
suspensão (ele acorda sozinho para rodar); desligado de vez, não. Se perder um horário, ela roda
assim que puder.

Rodar várias vezes no mesmo dia não faz mal. A coleta só pede à Steam os itens cuja série ainda não
chega a ontem (`historico_steam --pendentes`), então, se o dia já foi coletado, ela termina em
segundos sem pedir nada. Pelo mesmo motivo, uma coleta que parou no meio continua de onde parou na
próxima vez.

O ritmo é de um pedido a cada 30 segundos mais até 15 sorteados, então os 43 itens levam uns 25
minutos, em segundo plano, sem abrir janela. Ela roda do IP de casa de propósito: IPs de nuvem
(GitHub Actions, Render) levam bloqueio (HTTP 429) da Steam quase na hora.

## Como saber se está funcionando

Cada dia tem um log em `%LOCALAPPDATA%\Skinomics\logs\coleta-AAAA-MM-DD.log` (cole esse caminho no
Explorador de Arquivos). Uma coleta boa termina com "coleta terminou com código 0" e, se entrou
preço novo, "previsões terminaram com código 0". Dá para ver também o histórico das coletas no banco:

```
cd backend
uv run python -m app.coleta.execucoes
```

Quando algo precisa de atenção, aparece uma notificação do Windows com o título "Skinomics". Sem
notificação, está tudo certo.

| Notificação | O que aconteceu | O que fazer |
|---|---|---|
| a Steam pediu uma pausa | Bloqueio temporário por excesso de pedidos (429) | Nada. O resto é coletado na próxima vez. |
| atualize o cookie da Steam | O `steamLoginSecure` venceu, ou a conta não está em dólar | Trocar o cookie (abaixo) |
| a coleta falhou | Erro inesperado | Ler o log do dia |
| as previsões falharam | Os preços entraram, a previsão não | Ler o log do dia; rodar `ml.worker --once` à mão |
| os alertas falharam | Os preços entraram, os alertas não foram conferidos | Ler o log do dia; rodar `uv run python -m app.servicos.alertas` em `backend` |

## Como trocar o cookie da Steam

O cookie `steamLoginSecure` é o login da Steam no navegador, e vence de tempos em tempos (ou quando
você sai da conta). Para pegar um novo:

1. Entre em https://steamcommunity.com/market no navegador, logado na conta usada pela coleta. A
   carteira dessa conta precisa estar em **dólar (USD)**, a moeda da base.
2. Abra as ferramentas do desenvolvedor (F12), vá em **Aplicativo** (Chrome/Edge) ou
   **Armazenamento** (Firefox), depois **Cookies** e `https://steamcommunity.com`.
3. Copie o **valor** do cookie `steamLoginSecure` (um texto longo que começa com números e `%7C%7C`).
4. Em `backend/.env`, troque a linha `SKINOMICS_STEAM_LOGIN_SECURE=...` pelo valor novo e salve.
5. Rode a coleta de novo (abaixo) para conferir.

O cookie dá acesso à conta: nunca o coloque no git nem em variável `VITE_*`. O ideal é usar uma conta
secundária.

## Rodar, pausar e remover

Rodar agora, sem esperar o horário (no PowerShell):

```
Start-ScheduledTask -TaskName "Skinomics - coleta diaria"
```

Pausar sem apagar (e voltar depois):

```
Disable-ScheduledTask -TaskName "Skinomics - coleta diaria"
Enable-ScheduledTask -TaskName "Skinomics - coleta diaria"
```

Remover de vez, ou registrar de novo (com o caminho completo, de qualquer pasta):

```
powershell -ExecutionPolicy Bypass -File "C:\Users\Microsoft\Desktop\skinomics\skinomics\scripts\agendar_coleta.ps1" -Remover
powershell -ExecutionPolicy Bypass -File "C:\Users\Microsoft\Desktop\skinomics\skinomics\scripts\agendar_coleta.ps1"
```

Também dá para fazer tudo isso pelo aplicativo **Agendador de Tarefas** do Windows, procurando a
tarefa pelo nome. Para mudar o ritmo, edite os valores de `-Intervalo` e `-Variacao` no topo de
`scripts/coleta_diaria.ps1`.

## Cuidados

A tarefa usa o código da pasta do projeto. Ela precisa de uma versão com `historico_steam
--pendentes` (da branch `feat/coleta-diaria` em diante); numa versão antiga, a coleta falha e avisa.

Se a pasta do projeto mudar de lugar, registre a tarefa de novo, porque ela guarda o caminho do script.

Um Raspberry Pi em casa poderia rodar a mesma coleta sem depender do PC ligado: o caminho seria um
`cron` diário com os mesmos dois comandos do script (`historico_steam --pendentes` e
`ml.worker --once`).
