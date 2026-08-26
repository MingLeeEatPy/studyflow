# StudyFlow 同步配置

当前代码在没有云端配置时保持本地模式。要启用同步，需要先创建 Supabase 项目并执行 `supabase/migrations/001_sync_entities.sql`。

在 Cloudflare Pages 的项目设置中添加：

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<public-anon-key>
```

同时在 Supabase Auth 的 URL Configuration 中把生产 HTTPS 地址加入 Redirect URLs。不要把 service role key 放入前端或 Git。

测试流程：

1. 在电脑和手机使用同一 HTTPS 地址打开应用。
2. 在“专注设置 → 跨设备同步”输入邮箱，点击发送登录链接。
3. 在同一设备完成邮箱回跳后，先导出本地备份。
4. 点击立即同步，再在另一设备登录同一邮箱。
5. 断网创建任务，恢复网络后等待同步状态更新。

如果没有 Supabase 配置，页面会明确显示“尚未配置云同步服务”，所有数据仍只保存在当前浏览器。
