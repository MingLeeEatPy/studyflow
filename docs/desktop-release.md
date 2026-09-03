# StudyFlow Windows 桌面版发布与自动更新

这份说明只适用于安装版 StudyFlow，不影响浏览器 PWA。

## 一次性准备

自动更新使用两把配对的 Tauri 签名密钥：公开密钥写进应用，私钥只保存在发布电脑。私钥不能上传 GitHub、Cloudflare、Supabase，也不能发给他人。

在 PowerShell 运行下面的命令生成密钥；命令会要求你设置一个只由你保存的密码：

```powershell
$studyflowKeyDir = Join-Path $env:USERPROFILE '.tauri'
New-Item -ItemType Directory -Force -Path $studyflowKeyDir | Out-Null
npm.cmd exec tauri signer generate -- -w "$studyflowKeyDir\studyflow-updater.key"
```

将私钥文件和它的密码分别保存到密码管理器或离线加密备份：

```text
C:\Users\<你的 Windows 用户名>\.tauri\studyflow-updater.key
```

生成命令输出的 **Public key** 可以公开。把它写入 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`。同一处还要填入你现有 Cloudflare Pages 正式域名：

```json
"plugins": {
  "updater": {
    "pubkey": "生成命令输出的 Public key",
    "endpoints": ["https://你的正式域名/desktop/latest.json"],
    "windows": { "installMode": "passive" }
  }
}
```

并在 `bundle` 中加入：

```json
"createUpdaterArtifacts": true
```

## 每次发布新桌面版

1. 同时把 `src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 的版本号提高到相同的下一版，例如 `0.4.1`。
2. 在本次 PowerShell 窗口中设置私钥路径并构建：

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\studyflow-updater.key"
npm.cmd run desktop:build
```

3. 从 `src-tauri\target\release\bundle\nsis\` 取出：

```text
StudyFlow_<版本>_x64-setup.nsis.zip
StudyFlow_<版本>_x64-setup.nsis.zip.sig
```

4. 将 `.zip` 放到 Cloudflare Pages 静态站点的 `desktop/` 路径。该文件名必须带版本号，发布后不覆盖旧文件。
5. 覆盖 `desktop/latest.json`。其中 `signature` 必须完整复制匹配 `.sig` 文件的内容：

```json
{
  "version": "0.4.1",
  "notes": "本版本的简短更新说明。",
  "pub_date": "2026-09-03T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://你的正式域名/desktop/StudyFlow_0.4.1_x64-setup.nsis.zip",
      "signature": "完整的 .sig 文件内容"
    }
  }
}
```

6. 部署 Cloudflare Pages 后，先在浏览器访问 `https://你的正式域名/desktop/latest.json`，确认返回的是新 JSON。

## 用户体验

用户只需首次运行一次安装程序。之后打开 StudyFlow，在“专注设置”页点击“检查桌面版更新”；有新版本时点击“下载并重启”。Windows 会短暂关闭应用、安装更新并重新打开它，本地学习记录不会被删除。

未配置公开密钥和正式 HTTPS 地址以前，更新卡片会提示更新服务尚未准备好；这不会影响正常使用、云同步或计时。
