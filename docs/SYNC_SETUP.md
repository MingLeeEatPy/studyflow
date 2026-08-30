# StudyFlow 同步配置

没有云端配置时，StudyFlow 继续使用本地模式。启用同步前，在 Supabase 项目中执行 `supabase/migrations/001_sync_entities.sql`。

## Cloudflare 环境变量

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

不要把 service-role key、数据库密码或 SMTP 密码放进前端或 Git。

## Supabase Auth

在 Authentication → URL Configuration 中，将线上 HTTPS 地址加入 Site URL 和 Redirect URLs。启用 Email Provider；Google 登录按 `docs/AUTH_SETUP.md` 配置。StudyFlow 不使用手机号登录或短信验证码。

## 用户流程

1. 在电脑和手机使用同一个 HTTPS 地址打开 StudyFlow。
2. 进入“专注设置 → 跨设备同步”，使用 Google 或邮箱密码注册/登录。
3. 空白设备会自动下载云端数据；云端为空时会自动上传当前设备数据。
4. 只有本地和云端都存在独立学习数据时，首次登录才会询问“合并本地与云端”或“只保留本地”。
5. 另一台设备登录同一账号后会自动同步；“立即同步”只作为手动重试入口。
6. 离线创建的任务会在恢复网络、重新打开页面或定时同步时上传。

未登录时，所有数据仍只保存在当前浏览器的 IndexedDB 中。
