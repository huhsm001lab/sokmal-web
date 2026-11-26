@echo off
rem SOKMAL - Windows: double-click to open
chcp 65001 >nul
cd /d "%~dp0"
title SOKMAL
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 설치돼 있지 않아요. 설치 페이지를 열게요.
  echo LTS 버전을 설치한 뒤 이 파일을 다시 더블클릭해 주세요.
  echo Node.js is not installed. Install the LTS version, then open this file again.
  start "" "https://nodejs.org/ko/download"
  pause
  exit /b 1
)
node scripts\launch.mjs %*
if errorlevel 1 (
  echo.
  echo 문제가 생겼어요. 위 내용을 캡처해 보내 주세요.
  pause
)
