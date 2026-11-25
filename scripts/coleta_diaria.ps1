# Coleta diária do Skinomics, feita para rodar sozinha pelo Agendador de Tarefas do Windows
# (ver agendar_coleta.ps1): ao entrar no Windows e de madrugada, se o PC estiver ligado.
#
# 1. Baixa da Steam só os itens cuja série ainda não chega a ontem (--pendentes): se o dia já foi
#    coletado, sai sem pedir nada; se a Steam pediu uma pausa (429), continua da próxima vez.
# 2. Se entrou preço novo, publica as previsões dos modelos ativos (ml.worker --once) e confere
#    os alertas de preço dos usuários (app.servicos.alertas).
# 3. Avisa por notificação do Windows como terminou: deu certo, precisa de alguém (cookie
#    vencido) ou falhou, já com o motivo.
#
# Cada linha vai para o log e para a janela na hora em que acontece, para dar para acompanhar.
#
# Ritmo: um pedido a cada 30 s mais até 15 s sorteados. Ajuste com -Intervalo e -Variacao.

param(
    [double]$Intervalo = 30,
    [double]$Variacao = 15
)

$ErrorActionPreference = "Stop"
# Acentos do Python chegam inteiros no log (sem isso, "não" vira "nÒo").
$env:PYTHONIOENCODING = "utf-8"
# Sem buffer: cada linha do Python aparece na hora, não só quando ele termina.
$env:PYTHONUNBUFFERED = "1"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$raiz = Split-Path -Parent $PSScriptRoot
$pastaLogs = Join-Path $env:LOCALAPPDATA "Skinomics\logs"
New-Item -ItemType Directory -Force $pastaLogs | Out-Null
$log = Join-Path $pastaLogs ("coleta-{0:yyyy-MM-dd}.log" -f (Get-Date))

function Escrever-Log([string]$texto, [switch]$SoNoArquivo) {
    $linha = "{0:HH:mm:ss} {1}" -f (Get-Date), $texto
    $linha | Out-File -Append -Encoding utf8 $log
    if (-not $SoNoArquivo) { Write-Host $linha }
}

# Roda um programa, mandando cada linha da saída para o log assim que ela sai, e devolve a saída
# inteira e o código de saída. O Python escreve o log em stderr; com $ErrorActionPreference =
# "Stop", o PowerShell 5.1 tomaria a primeira linha dele como erro fatal.
function Rodar([string]$programa, [string[]]$argumentos) {
    $antes = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $saida = New-Object System.Collections.Generic.List[string]
    try {
        & $programa @argumentos 2>&1 | ForEach-Object {
            $linha = "$_"
            $saida.Add($linha)
            # Os pedidos que deram certo só poluem a janela; ficam no arquivo.
            Escrever-Log $linha -SoNoArquivo:($linha -match 'HTTP Request: .*" 200 OK"$')
        }
        return @{ Saida = $saida.ToArray(); Codigo = $LASTEXITCODE }
    } finally {
        $ErrorActionPreference = $antes
    }
}

# Última linha que explica alguma coisa, para pôr na notificação de falha.
function Ultimo-Motivo([string[]]$saida) {
    $util = $saida | Where-Object { $_ -and $_ -notmatch 'HTTP Request:' } | Select-Object -Last 1
    if ($util) { return $util.Trim() } else { return "sem mensagem do Python" }
}

function Mostrar-Aviso([string]$titulo, [string]$texto) {
    # Notificação nativa do Windows, em nome do PowerShell (não precisa instalar nada).
    try {
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $modelo = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(
            [Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $linhas = $modelo.GetElementsByTagName("text")
        $linhas.Item(0).AppendChild($modelo.CreateTextNode($titulo)) | Out-Null
        $linhas.Item(1).AppendChild($modelo.CreateTextNode($texto)) | Out-Null
        $app = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe"
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show(
            [Windows.UI.Notifications.ToastNotification]::new($modelo))
    } catch {
        Escrever-Log "não deu para mostrar a notificação: $_"
    }
}

# Impede o Windows de suspender no meio: o Python só grava no banco quando termina, então uma
# coleta cortada no meio perde tudo.
function Manter-Acordado([bool]$ligado) {
    try {
        if (-not ("Skinomics.Energia" -as [type])) {
            Add-Type -Namespace Skinomics -Name Energia -MemberDefinition `
                '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint estado);'
        }
        # ES_CONTINUOUS (0x80000000), mais ES_SYSTEM_REQUIRED (0x1) enquanto a coleta roda.
        $estado = if ($ligado) { [uint32]"0x80000001" } else { [uint32]"0x80000000" }
        [Skinomics.Energia]::SetThreadExecutionState($estado) | Out-Null
    } catch {
        Escrever-Log "não deu para impedir a suspensão: $_"
    }
}

# O logon e a madrugada podem disparar juntos: só uma coleta por vez.
$trava = New-Object System.Threading.Mutex($false, "Global\SkinomicsColetaDiaria")
if (-not $trava.WaitOne(0)) {
    exit 0
}

$Host.UI.RawUI.WindowTitle = "Skinomics: coleta de preços (não feche)"
Write-Host ""
Write-Host "Skinomics está baixando os preços do dia na Steam." -ForegroundColor Green
Write-Host "Leva uns 30 minutos com todos os itens pendentes. Se fechar esta janela, a coleta para"
Write-Host "e nada do que foi baixado é gravado. Ela fecha sozinha quando terminar."
Write-Host "Log completo: $log"
Write-Host ""

Manter-Acordado $true
try {
    Escrever-Log "início da coleta (intervalo $Intervalo s, variação $Variacao s)"
    $uv = (Get-Command uv -ErrorAction SilentlyContinue).Source
    if (-not $uv) { $uv = Join-Path $env:USERPROFILE ".local\bin\uv.exe" }
    if (-not (Test-Path $uv)) {
        throw "não achei o uv (nem no PATH nem em $uv); sem ele não dá para rodar o Python do projeto"
    }

    Push-Location (Join-Path $raiz "backend")
    try {
        $resultado = Rodar $uv @("run", "python", "-m", "app.coleta.historico_steam",
            "--arquivo", "app/coleta/itens_tf2.txt", "--moeda", "USD", "--pendentes",
            "--intervalo", "$Intervalo", "--variacao", "$Variacao")
        $saida, $codigo = $resultado.Saida, $resultado.Codigo
    } finally {
        Pop-Location
    }
    Escrever-Log "coleta terminou com código $codigo"

    $gravados = $saida | Select-String -Pattern "^(\d+) itens e (\d+) preços" | Select-Object -First 1
    $itensGravados = if ($gravados) { [int]$gravados.Matches[0].Groups[1].Value } else { 0 }
    $emDia = ($saida | Select-String -Pattern "^Nada a coletar") -ne $null

    switch ($codigo) {
        0 {
            if ($emDia) { Escrever-Log "resultado: os preços de ontem já estavam no banco, nada a fazer." }
            else { Escrever-Log "resultado: $itensGravados itens atualizados." }
        }
        10 {
            Escrever-Log "resultado: a Steam pediu uma pausa (429) depois de $itensGravados itens; o resto fica para a próxima vez."
            Mostrar-Aviso "Skinomics: a Steam pediu uma pausa" "$itensGravados itens gravados. O resto fica para a próxima vez que o PC ligar."
        }
        11 {
            Escrever-Log "resultado: a Steam não aceitou o cookie. Troque SKINOMICS_STEAM_LOGIN_SECURE no backend\.env (passo a passo em docs\coleta-diaria.md)."
            Mostrar-Aviso "Skinomics: atualize o cookie da Steam" "O steamLoginSecure venceu (ou a conta está em outra moeda). Troque SKINOMICS_STEAM_LOGIN_SECURE no backend\.env."
        }
        default {
            $motivo = Ultimo-Motivo $saida
            Escrever-Log "resultado: a coleta falhou (código $codigo). Motivo: $motivo"
            Mostrar-Aviso "Skinomics: a coleta falhou" "$motivo (log em $log)"
        }
    }

    # Previsões só quando entrou preço novo (coleta inteira ou parcial).
    if ($itensGravados -gt 0) {
        Escrever-Log "publicando previsões"
        Push-Location $raiz
        try {
            $resultado = Rodar $uv @("run", "--project", "ml", "--env-file", "backend/.env",
                "python", "-m", "ml.worker", "--once")
            $saidaMl, $codigoMl = $resultado.Saida, $resultado.Codigo
        } finally {
            Pop-Location
        }
        Escrever-Log "previsões terminaram com código $codigoMl"
        if ($codigoMl -ne 0) {
            $motivo = Ultimo-Motivo $saidaMl
            Escrever-Log "resultado: os preços entraram, mas as previsões falharam. Motivo: $motivo"
            Mostrar-Aviso "Skinomics: as previsões falharam" "Os preços entraram, mas a previsão não: $motivo"
        } elseif ($codigo -eq 0) {
            Mostrar-Aviso "Skinomics: preços atualizados" "$itensGravados itens com os preços de ontem, e as previsões publicadas."
        }

        # Alertas de preço: só mudam com preço novo. O aviso de cada usuário aparece no sino do site.
        Escrever-Log "conferindo os alertas de preço"
        Push-Location (Join-Path $raiz "backend")
        try {
            $resultado = Rodar $uv @("run", "python", "-m", "app.servicos.alertas")
            $saidaAlertas, $codigoAlertas = $resultado.Saida, $resultado.Codigo
        } finally {
            Pop-Location
        }
        if ($codigoAlertas -ne 0) {
            $motivo = Ultimo-Motivo $saidaAlertas
            Escrever-Log "resultado: os alertas não foram conferidos. Motivo: $motivo"
            Mostrar-Aviso "Skinomics: os alertas falharam" "Os preços entraram, mas os alertas não foram conferidos: $motivo"
        }
    }
} catch {
    Escrever-Log "erro: $_"
    Mostrar-Aviso "Skinomics: a coleta falhou" "$_ (log em $log)"
} finally {
    Manter-Acordado $false
    $trava.ReleaseMutex()
}
