#!/usr/bin/env bash

set -euo pipefail

NODE_DIR="${STUDYFLOW_NODE_DIR:-$HOME/.local/opt/node-v24.19.0-linux-x64}"

if [[ ! -x "$NODE_DIR/bin/node" ]]; then
  echo "找不到 StudyFlow 使用的 Node.js：$NODE_DIR/bin/node" >&2
  echo "请安装 Node.js 24.19.0，或通过 STUDYFLOW_NODE_DIR 指定安装目录。" >&2
  exit 1
fi

export PATH="$NODE_DIR/bin:/usr/bin:/bin"

case "${1:-dev}" in
  dev)
    exec npm run dev
    ;;
  build)
    exec npm run build
    ;;
  test)
    exec npm test
    ;;
  lint)
    exec npm run lint
    ;;
  *)
    echo "用法：./studyflow.sh [dev|build|test|lint]" >&2
    exit 2
    ;;
esac
