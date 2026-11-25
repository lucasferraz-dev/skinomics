# Coleta diária do Skinomics, feita para rodar sozinha pelo Agendador de Tarefas do Windows
# (ver agendar_coleta.ps1): ao entrar no Windows e de madrugada, se o PC estiver ligado.
#
# 1. Baixa da Steam só os itens cuja série ainda não chega a ontem (--pendentes): se o dia já foi
#    coletado, sai sem pedir nada; se a Steam pediu uma pausa (429), continua da próxima vez.
# 2. Se entrou preço novo, publica as previsões dos modelos ativos (ml.worker --once).
# 3. Avisa por notificação do Windows quando precisa de alguém (cookie vencido) ou quando falhou.
#
# Ritmo: um pedido a cada 30 s mais até 15 s sorteados. Ajuste com -Intervalo e -Variacao.

param(
    [double]$Intervalo = 30,
    [double]$Variacao = 15
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$pastaLogs = Join-Path $env:LOCALAPPDATA "Skinomics\logs"
New-Item -ItemType Directory -Force $pastaLogs | Out-Null
$log = Join-Path $pastaLogs ("coleta-{0:yyyy-MM-dd}.log" -f (Get-Date))

function Escrever-Log([string]$texto) {
    "{0:HH:mm:ss} {1}" -f (Get-Date), $texto | Out-File -Append -Encoding utf8 $log
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

# O logon e a madrugada podem disparar juntos: só uma coleta por vez.
$trava = New-Object System.Threading.Mutex($false, "Global\SkinomicsColetaDiaria")
if (-not $trava.WaitOne(0)) {
    exit 0
}

try {
    Escrever-Log "início da coleta (intervalo $Intervalo s, variação $Variacao s)"
    $uv = (Get-Command uv -ErrorAction SilentlyContinue).Source
    if (-not $uv) { $uv = Join-Path $env:USERPROFILE ".local\bin\uv.exe" }

    Push-Location (Join-Path $raiz "backend")
    try {
        $saida = & $uv run python -m app.coleta.historico_steam `
            --arquivo app/coleta/itens_tf2.txt --moeda USD --pendentes `
            --intervalo $Intervalo --variacao $Variacao 2>&1
        $codigo = $LASTEXITCODE
    } finally {
        Pop-Location
    }
    $saida | ForEach-Object { Escrever-Log "$_" }
    Escrever-Log "coleta terminou com código $codigo"

    switch ($codigo) {
        10 { Mostrar-Aviso "Skinomics: a Steam pediu uma pausa" "A coleta parou no limite de pedidos (429). O resto fica para a próxima vez que o PC ligar." }
        11 { Mostrar-Aviso "Skinomics: atualize o cookie da Steam" "O steamLoginSecure venceu (ou a conta está em outra moeda). Troque SKINOMICS_STEAM_LOGIN_SECURE no backend\.env." }
        { $_ -notin 0, 10, 11 } { Mostrar-Aviso "Skinomics: a coleta falhou" "Veja o log em $log." }
    }

    # Previsões só quando entrou preço novo (coleta inteira ou parcial).
    $gravou = ($saida | Select-String -Pattern "^([1-9]\d*) itens e") -ne $null
    if ($gravou) {
        Escrever-Log "publicando previsões"
        Push-Location $raiz
        try {
            $saidaMl = & $uv run --project ml --env-file backend/.env python -m ml.worker --once 2>&1
            $codigoMl = $LASTEXITCODE
        } finally {
            Pop-Location
        }
        $saidaMl | ForEach-Object { Escrever-Log "$_" }
        Escrever-Log "previsões terminaram com código $codigoMl"
        if ($codigoMl -ne 0) {
            Mostrar-Aviso "Skinomics: as previsões falharam" "Os preços entraram, mas a previsão não. Veja o log em $log."
        }
    }
} catch {
    Escrever-Log "erro: $_"
    Mostrar-Aviso "Skinomics: a coleta falhou" "Veja o log em $log."
} finally {
    $trava.ReleaseMutex()
}
