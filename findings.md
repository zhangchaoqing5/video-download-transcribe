# 调研记录

## 已确认

- 当前 `server.ts` 使用 `.local-data/workspace.json` 存储 `workingDirectory`、`recentDirectories` 和 `updatedAt`。
- Job 记录另存于 `.local-data/jobs/`；任务的 `outputDir` 在创建时解析为绝对路径，工作目录切换不影响既有任务打开产物或查看结果。
- 当前工作目录弹窗虽实现了“最近使用记录”，但将按产品决策整体移除。
- 当前默认目录为下载 `output`、转写 `transcripts`、Pipeline `runs`；目标改为 `videos`、`transcripts`、`pipeline`。
- 页面表单目前均由各视图内的 React `useState` 初始化，没有统一的偏好读取或变更保存机制；其状态类型在 `src/types.ts` 中定义。
- `PipelineFormState` 现有 `downloadOnly` 字段，需从类型、界面和服务端任务调用链一并清除。
- 设置接口将以页面分区读写 `settings.json`，当前工作目录在同一文件的 `workspace` 分区；旧 `workspace.json` 在首次成功保存时迁移并删除。

## 待确认

- 逐页识别哪些字段属于可复用偏好、哪些属于一次性输入，并将保存边界落到现有数据模型。
