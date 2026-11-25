# Registra a coleta diária no Agendador de Tarefas do Windows, para o usuário atual.
#
# Ela dispara 3 minutos depois de entrar no Windows e às 3h da manhã (acordando o PC da suspensão,
# se ele estiver só suspenso). Se o dia já foi coletado, a coleta sai sem pedir nada à Steam.
#
#   powershell -ExecutionPolicy Bypass -File scripts\agendar_coleta.ps1            # registrar
#   powershell -ExecutionPolicy Bypass -File scripts\agendar_coleta.ps1 -Remover   # remover

param([switch]$Remover)

$ErrorActionPreference = "Stop"
$nome = "Skinomics - coleta diaria"

if ($Remover) {
    Unregister-ScheduledTask -TaskName $nome -Confirm:$false
    Write-Output "Tarefa '$nome' removida."
    exit 0
}

$script = Join-Path $PSScriptRoot "coleta_diaria.ps1"
$usuario = "$env:USERDOMAIN\$env:USERNAME"

$acao = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""

$aoEntrar = New-ScheduledTaskTrigger -AtLogOn -User $usuario
$aoEntrar.Delay = "PT3M"  # deixa a rede e o Windows terminarem de subir
$deMadrugada = New-ScheduledTaskTrigger -Daily -At 3am

$ajustes = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -WakeToRun `
    -RunOnlyIfNetworkAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 6)

# Roda com o usuário logado (precisa dele para mostrar as notificações).
$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $aoEntrar, $deMadrugada `
    -Settings $ajustes -Principal $principal `
    -Description "Baixa da Steam os preços do dia do Skinomics e publica as previsões." -Force | Out-Null

Write-Output "Tarefa '$nome' registrada: roda ao entrar no Windows e às 3h."
Write-Output "Logs em $(Join-Path $env:LOCALAPPDATA 'Skinomics\logs')."
