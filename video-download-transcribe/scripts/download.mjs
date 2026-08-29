#!/usr/bin/env node
import process from 'node:process';
import { parseCli, readUrlFile, requireUrls } from './core/cli.mjs';
import { downloadUrls } from './core/download.mjs';
import { runEntrypoint } from './core/entrypoint.mjs';

function usage() {
  return `
使用 yt-dlp 批量下载视频（跨平台 Node Skill）。

用法：
  node video-download-transcribe/scripts/download.mjs [选项] URL [URL ...]
  node video-download-transcribe/scripts/download.mjs --file urls.txt [选项]

选项：
  -f, --file <路径>              URL 文本文件；每行一个 URL，# 开头的行忽略
  -o, --output <目录>            输出目录；默认当前目录下 output/
  -q, --quality <best|高度>      默认 best；例如 2160、1080、720
      --parallel <1-8>           同时下载的 URL 数；默认 1
      --cookies <模式>           none、browser 或 file；默认 none
      --browser <名称>           Chrome、Safari、Firefox 等；默认 chrome
      --browser-profile <名称>   浏览器 Profile（仅 browser 模式）
      --cookies-file <路径>      Netscape 格式 cookies.txt（仅 file 模式）
      --yt-dlp <路径>            yt-dlp 命令或可执行文件路径
      --ffmpeg <路径>            ffmpeg 命令或可执行文件路径
      --js-runtime <模式>        auto、node 或 deno；默认 auto
      --remote-ejs <来源>        npm 或 github；允许 yt-dlp 获取缺失 EJS 组件
      --yt-dlp-arg <参数>        高级：原样追加一个 yt-dlp 参数，可重复
  -h, --help                     显示帮助

默认不会读取 Cookie，也不会自动安装 yt-dlp、ffmpeg、Node 或 Deno。
`;
}

await runEntrypoint(async () => {
  const { options, positionals } = parseCli(process.argv.slice(2), [
    { name: 'help', aliases: ['-h'], type: 'boolean', default: false },
    { name: 'file', aliases: ['-f'], type: 'value' },
    { name: 'output', aliases: ['-o'], type: 'value', default: 'output' },
    { name: 'quality', aliases: ['-q'], type: 'value', default: 'best' },
    { name: 'parallel', type: 'value', default: '1' },
    { name: 'cookies', type: 'value', default: 'none' },
    { name: 'browser', type: 'value', default: 'chrome' },
    { name: 'browserProfile', aliases: ['--browser-profile'], type: 'value' },
    { name: 'cookiesFile', aliases: ['--cookies-file'], type: 'value' },
    { name: 'ytDlp', aliases: ['--yt-dlp'], type: 'value' },
    { name: 'ffmpeg', type: 'value' },
    { name: 'jsRuntime', aliases: ['--js-runtime'], type: 'value', default: 'auto' },
    { name: 'remoteEjs', aliases: ['--remote-ejs'], type: 'value' },
    { name: 'extraArgs', aliases: ['--yt-dlp-arg'], type: 'repeat' },
  ]);
  if (options.help) {
    console.log(usage());
    return;
  }
  const urls = requireUrls([...positionals, ...(options.file ? await readUrlFile(String(options.file)) : [])]);
  const result = await downloadUrls({ ...options, urls });
  const failed = result.results.filter((item) => !item.ok);
  console.log(`下载完成：${result.results.length - failed.length}/${result.results.length} 成功。`);
  for (const item of failed) console.error(`失败：${item.url}（${item.error ?? '未知错误'}）`);
  if (failed.length > 0) process.exitCode = 1;
});
