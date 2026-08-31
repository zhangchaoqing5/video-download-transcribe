# 调研记录

## 已确认

- 当前 `server.ts` 使用 `.local-data/workspace.json` 存储 `workingDirectory`、`recentDirectories` 和 `updatedAt`。
- Job 记录另存于 `.local-data/jobs/`；任务的 `outputDir` 在创建时解析为绝对路径，工作目录切换不影响既有任务打开产物或查看结果。
- 当前工作目录弹窗虽实现了“最近使用记录”，但将按产品决策整体移除。
- 当前默认目录为下载 `output`、转写 `transcripts`、Pipeline `runs`；目标改为 `videos`、`transcripts`、`pipeline`。
- 页面表单目前均由各视图内的 React `useState` 初始化，没有统一的偏好读取或变更保存机制；其状态类型在 `src/types.ts` 中定义。
- `PipelineFormState` 现有 `downloadOnly` 字段，需从类型、界面和服务端任务调用链一并清除。
- 设置接口将以页面分区读写 `settings.json`，当前工作目录在同一文件的 `workspace` 分区；旧 `workspace.json` 在首次成功保存时迁移并删除。

## 2026-08-31：Job 产物模型

- Pipeline 已在 `pipeline/<batch>/items/001/` 下隔离视频和转写产物，但普通下载直接写入 `videos/`，本地转写直接写入 `transcripts/`，因此普通 Job 的历史输出不可可靠归属。
- 当前任务详情 API 已递归扫描目录；已验证当前 Pipeline 的接口可返回 `items/001`、`items/002` 下的 MP4 与 TXT。
- 页面空成果区的直接原因是：详情 API 返回 `outputFiles` 后，SSE `init` 又用不含 `outputFiles` 的内存 Job 覆盖了前端状态。
- yt-dlp 输出文件名包含外部标题和视频 ID，不能作为本系统 Job 归属依据；应以 Job ID 目录和清单为准。
- 当前 Pipeline 使用 `batch.json`、`task.json`。新模型应以通用 `job.json` 为准，旧元数据仅用于兼容读取。
