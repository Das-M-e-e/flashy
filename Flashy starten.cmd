@echo off
setlocal
title Flashy

rem UTF-8, sonst erscheinen Umlaute in der Konsole verstuemmelt.
chcp 65001 >nul

rem Node ist bei einer normalen Installation nicht immer im PATH des Explorers.
set "PATH=C:\Program Files\nodejs;%PATH%"

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Node.js wurde nicht gefunden.
  echo   Bitte einmalig installieren: https://nodejs.org  ^(LTS-Version^)
  echo.
  pause
  exit /b 1
)

rem Beim ersten Start (oder nach "git pull") fehlen die Abhaengigkeiten.
if not exist "node_modules" (
  echo.
  echo   Erster Start: Abhaengigkeiten werden installiert. Das dauert einen Moment ...
  echo.
  call npm install || goto :fehler
)

rem "Flashy starten.cmd rebuild" erzwingt einen Neubau nach Code-Aenderungen.
if /i "%~1"=="rebuild" (
  rmdir /s /q "server\dist" 2>nul
  rmdir /s /q "client\dist" 2>nul
)

if not exist "server\dist\index.js" goto :bauen
if not exist "client\dist\index.html" goto :bauen
goto :starten

:bauen
echo.
echo   Anwendung wird gebaut ...
echo.
call npm run build || goto :fehler

:starten
echo.
echo   Flashy startet auf http://localhost:4000
echo   Der Browser oeffnet sich gleich automatisch.
echo.
echo   Zum Beenden: dieses Fenster anklicken und Strg+C druecken.
echo   ^(Nur so werden offene Aenderungen noch synchronisiert.^)
echo.

rem Browser erst oeffnen, wenn der Server wirklich lauscht (max. 30 Sekunden warten).
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for ($i=0; $i -lt 30; $i++) { try { Invoke-WebRequest 'http://127.0.0.1:4000' -TimeoutSec 1 -UseBasicParsing | Out-Null; Start-Process 'http://localhost:4000'; break } catch { Start-Sleep -Seconds 1 } }"

call npm start

echo.
echo   Flashy wurde beendet.
echo.
pause
endlocal
exit /b 0

:fehler
echo.
echo   Es ist ein Fehler aufgetreten. Die Meldung steht oben.
echo.
pause
exit /b 1
