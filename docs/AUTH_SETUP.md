# StudyFlow 登录与同步配置

## 必要的 Supabase 设置

1. 在 Authentication → Providers 中启用 Email，并决定是否要求邮箱确认。
2. 在 URL Configuration 中将线上 HTTPS 地址加入 Site URL 和 Redirect URLs。
3. 若启用 Google，在 Google Cloud OAuth 中将线上地址加入 Authorized JavaScript origins，并将 Supabase 提供的 callback URL 加入 Authorized redirect URIs。
4. 在 Authentication → SMTP Settings 配置正式邮件服务，用于邮箱确认和密码重置。
5. 若启用手机号，在 Phone Provider 中配置 Twilio、MessageBird、Vonage 或其他支持的 SMS 服务商。

## 用户使用方式

- 未登录用户仍可在当前设备离线使用，数据只保存在本机。
- 在“专注设置 → 跨设备同步”注册或登录后，可选择将本地数据合并到云端。
- 另一台设备使用同一 Google 或邮箱密码账号登录，再点击“立即同步”。
- 忘记密码可从登录面板发送邮箱重置邮件；已绑定且验证过的手机号可用于后续短信恢复。
- 手机号不是唯一恢复方式，换号或短信服务不可用时仍可使用邮箱恢复。

## 环境变量

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
```

只把 publishable/anon key 放进前端环境变量，绝不要把 service-role key、数据库密码或 SMTP 密码提交到仓库。

## 扩容原则

IndexedDB 是离线缓存；登录后 Supabase 是云端主数据。同步采用本地 outbox、增量游标和按更新时间索引，服务器压力主要来自云端记录、同步请求、认证邮件/短信、数据库连接和磁盘，而不是用户本地缓存本身。用户增长后优先升级数据库计算资源、连接池和监控，再增加队列、归档与对象存储。
