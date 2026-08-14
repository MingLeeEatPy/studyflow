# StudyFlow

StudyFlow 是一个 Web-first 的个人学习计划与执行助手。V1 聚焦任务规划、Today、艾森豪威尔四象限、分类管理和浏览器本地持久化，为后续执行记录、统计分析、PWA 和 AI Planner 保留扩展边界。

## V1 功能

- 新建、编辑、完成、重新打开和归档任务
- 四象限看板与任务列表切换
- 分类、状态和截止日期筛选
- Today 今日/逾期任务与计划、完成、剩余时长
- 独立分类管理
- IndexedDB 本地持久化和 TaskEvent 历史
- 完整 JSON 导出和校验后的覆盖导入

## 启动

项目固定使用用户目录中的 Node.js 24.19.0。Ubuntu 上直接运行：

```bash
cd /home/minglee/Projects/studyflow
./studyflow.sh
```

浏览器访问 `http://127.0.0.1:5173`。

其他命令：

```bash
./studyflow.sh test
./studyflow.sh lint
./studyflow.sh build
```

## 数据与备份

V1 数据保存在当前浏览器的 IndexedDB 中。刷新页面或关闭浏览器不会丢失，但不同浏览器、不同网址和不同设备之间不会自动共享。

建议定期点击应用左下角“数据管理”并导出 JSON。覆盖导入前，StudyFlow 会先触发下载一份当前数据的安全备份；无效或不兼容的文件不会修改现有数据库。

任务在 UI 中删除后会归档而不是物理清除，TaskEvent 会保留创建、编辑、完成、重开和归档记录，为未来完成率与计划分析提供历史基础。

## 开发

首次重新安装依赖时：

```bash
export PATH="$HOME/.local/opt/node-v24.19.0-linux-x64/bin:$PATH"
npm install
```

## Roadmap

- V1 Plan：任务、Today、四象限、分类和本地历史（当前版本）
- V2 Execution：Focus Mode、计时、番茄钟和实际学习记录
- V3 Experience + PWA：离线安装、环境音和主题体验
- V4 Analytics + Sync：学习统计、完成率、趋势和可选同步
- V5 AI Planner：根据目标、可用时间和历史执行情况动态调整计划

## License

StudyFlow 使用 [MIT License](./LICENSE)。
