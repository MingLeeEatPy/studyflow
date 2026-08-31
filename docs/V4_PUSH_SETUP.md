# StudyFlow V4 后台提醒上线清单

微缩计时和后台返回校正不需要额外配置。下面只用于开启“本设备后台提醒”。

## 1. 应用数据库迁移

在 Supabase 的 SQL Editor 中运行 `supabase/migrations/002_push_reminders.sql`。它只新增推送订阅和计时提醒表，不修改现有学习数据。

## 2. 生成 VAPID 密钥

在本机项目目录运行：

```powershell
npx.cmd web-push generate-vapid-keys
```

公钥可以放到 Cloudflare；私钥只能放 Supabase Secrets，不能提交到 GitHub。

## 3. 配置 Cloudflare Pages

在 StudyFlow 项目的 Variables and Secrets 添加：

```text
VITE_WEB_PUSH_VAPID_PUBLIC_KEY=<上一步的 Public Key>
```

保存后重新部署一次。

## 4. 配置并部署 Supabase Edge Function

在 Supabase Edge Function Secrets 添加：

```text
WEB_PUSH_VAPID_PUBLIC_KEY=<Public Key>
WEB_PUSH_VAPID_PRIVATE_KEY=<Private Key>
WEB_PUSH_VAPID_SUBJECT=mailto:<你的联系邮箱>
CRON_SECRET=<自己生成的一段至少 32 位随机字符>
```

`SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase Edge Function 自动提供，不要放进前端或 Cloudflare。

部署 `supabase/functions/dispatch-timer-reminders`，并关闭该函数的 JWT 校验；函数自身会验证 `x-cron-secret`。

## 5. 创建每分钟调度

在 Supabase Dashboard 的 Cron 中新建每分钟任务，请求 Edge Function 地址：

```text
https://<project-ref>.supabase.co/functions/v1/dispatch-timer-reminders
```

请求方法选 `POST`，Header 添加：

```text
x-cron-secret: <与 CRON_SECRET 完全相同的值>
```

## 6. 真机验收

从 Safari 将 StudyFlow 添加到 iPad 主屏幕，登录后进入“专注设置 → 本设备后台提醒”，依次点击“启用本设备后台提醒”和“发送测试提醒”。随后开始一个 1 分钟番茄，锁屏或切换到 Notability，确认系统通知能到达。

Web Push 通常在到点后 0～60 秒内送达。设备断网、系统关闭通知或 Apple 推送服务延迟时不保证准点，但重新打开 StudyFlow 后计时会立即按真实时间校正。
