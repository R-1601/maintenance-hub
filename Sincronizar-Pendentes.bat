@echo off
REM =========================================================================
REM Sincronizar-Pendentes.bat
REM Script para sincronizar dados pendentes com Supabase
REM =========================================================================

setlocal enabledelayedexpansion

color 0A
cls

echo ╔════════════════════════════════════════════════════════════════════════╗
echo ║                                                                        ║
echo ║         SINCRONIZADOR DE ORDENS DE SERVIÇO - Sem RLS                 ║
echo ║                                                                        ║
echo ╚════════════════════════════════════════════════════════════════════════╝
echo.

REM Verificar se Node.js está instalado
where node >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Node.js não está instalado!
    echo    Baixe em: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js encontrado

REM Pedir dados do usuário
echo.
echo Informe as credenciais do Supabase:
echo.

set /p SUPABASE_URL="➤ URL do Supabase (https://seu-projeto.supabase.co): "

if "!SUPABASE_URL!"=="" (
    echo ❌ URL não pode estar vazia!
    pause
    exit /b 1
)

echo.
set /p SUPABASE_KEY="➤ Chave do Supabase (encontre em Settings → API): "

if "!SUPABASE_KEY!"=="" (
    echo ❌ Chave não pode estar vazia!
    pause
    exit /b 1
)

echo.
set /p ARQUIVO="➤ Arquivo de dados (deixe em branco para 'os_pendentes_backup.json'): "

if "!ARQUIVO!"=="" (
    set ARQUIVO=os_pendentes_backup.json
)

REM Verificar se arquivo existe
if not exist "!ARQUIVO!" (
    echo.
    echo ❌ Arquivo não encontrado: !ARQUIVO!
    echo    
    echo 💡 Como obter o arquivo:
    echo    1. Abra seu Maintenance Hub
    echo    2. Vá para "Importar Ordens de Serviço"
    echo    3. Clique em "Exportar pendentes"
    echo    4. Salve o arquivo aqui
    echo.
    pause
    exit /b 1
)

REM Resumo
echo.
echo ╔════════════════════════════════════════════════════════════════════════╗
echo ║                           RESUMO                                       ║
echo ╚════════════════════════════════════════════════════════════════════════╝
echo.
echo   URL:     !SUPABASE_URL!
echo   Chave:   !SUPABASE_KEY:~0,20!...
echo   Arquivo: !ARQUIVO!
echo.

set /p CONFIRMA="Confirma sincronização? (S/N): "

if /i not "!CONFIRMA!"=="S" (
    echo ❌ Cancelado
    pause
    exit /b 1
)

REM Executar Node.js
echo.
echo 🔄 Sincronizando...
echo.

node sincronizar-pendentes.js "!SUPABASE_URL!" "!SUPABASE_KEY!" "!ARQUIVO!"

if !errorlevel! equ 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════════════════════╗
    echo ║                   ✅ SUCESSO!                                          ║
    echo ╚════════════════════════════════════════════════════════════════════════╝
    echo.
    echo 📌 Os dados foram sincronizados com o Supabase!
    echo    Atualize seu Maintenance Hub para ver as mudanças.
    echo.
) else (
    echo.
    echo ╔════════════════════════════════════════════════════════════════════════╗
    echo ║                   ❌ ERRO!                                             ║
    echo ╚════════════════════════════════════════════════════════════════════════╝
    echo.
    echo 💡 Verifique:
    echo    • URL está correta?
    echo    • Chave é válida?
    echo    • Arquivo contém dados?
    echo.
)

pause
