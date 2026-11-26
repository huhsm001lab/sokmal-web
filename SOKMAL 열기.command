#!/bin/bash
# SOKMAL 속말 — 맥에서 더블클릭해서 열기
cd "$(dirname "$0")" || exit 1
# Finder에서 열면 PATH가 짧아서, Node.js가 흔히 설치되는 곳을 더해 줌
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js가 설치돼 있지 않아요. 설치 페이지를 열게요."
  echo "LTS 버전을 설치한 뒤 이 파일을 다시 더블클릭해 주세요."
  open "https://nodejs.org/ko/download"
  read -n 1 -s -r -p "아무 키나 누르면 닫혀요"
  exit 1
fi
node scripts/launch.mjs "$@"
status=$?
if [ $status -ne 0 ]; then
  echo
  read -n 1 -s -r -p "문제가 생겼어요. 위 내용을 캡처해 보내 주세요. (아무 키나 누르면 닫혀요)"
fi
exit $status
