# 进度日志

## 2026-08-30

- 已创建规划文件，开始审查现有配置持久化和各页面表单逻辑。
- 已确认当前工作区无既有代码修改；配置与任务的实现集中于 `server.ts`，页面表单状态分散在四个视图组件。
- 已完成服务端 `settings.json` 的基础读写与旧工作目录配置兼容迁移，并开始将四个页面接入即时偏好保存。
- 已完成页面接入、目录历史与仅下载 Pipeline 模式移除；`pnpm run check`、`pnpm run build` 通过，开发服务可成功监听 3000 端口。

## 2026-08-31

- 用户确认实施统一 Job 产物隔离和成果展示模型。
- 已完成现状核对：Pipeline 已递归生成 `001/002`，但普通下载与转写没有 Job 级目录隔离。
- 已确认 Pipeline 成果区空白由 SSE `init` 原始 Job 覆盖完整详情导致；服务端 API 实际返回了 10 个产物文件。
- 当前阶段：设计并实现通用 Job 清单与输出目录链路。
- 已确认最终身份模型：Job ID 标识一次提交；Task UUID 标识其每条输入任务。外部平台 ID 只作来源元数据，标题是统一展示字段。
- 已实现三类新任务的统一目录：`<输出根>/<jobId>/<taskUuid>/<taskUuid>.<ext>`；Pipeline 不再创建 `items/001`、`video`、`transcript`、`batch.json` 或 `task.json` 层级。
- 已为新任务在启动时写入 `job.json` 清单；任务详情仅展示清单登记的文件，避免运行期或公共输出根中的旧文件串入当前 Job。
- 已定位并修复 Pipeline 运行期误扫公共 `pipeline` 根目录的原因：原逻辑在任务完成后才将 `outputDir` 改为 `pipeline/<jobId>`。现已在创建时固定该目录，并为此前运行的任务提供安全迁移。
- 任务中心按 Task UUID 清单卡片展示真实标题与来源 URL；本地转写使用原文件名作为标题，并提供来源文件定位和单任务目录入口。
- 验证完成：`pnpm run check`、`pnpm run build`、`git diff --check` 以及注入式 Pipeline 隔离 smoke test 均通过。项目未配置 Vitest，因此未运行不存在的测试命令。
