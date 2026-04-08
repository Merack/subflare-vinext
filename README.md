# Subflare

Subflare 是一个运行在 Cloudflare Workers 上的订阅到期提醒管理应用，基于 Next.js 16, [vinext](https://blog.cloudflare.com/vinext/), shadcn-ui和 Drizzle ORM 构建

它用于集中管理各类订阅项目，跟踪到期时间、记录续费历史，并通过可扩展的通知渠道发送到期提醒

(其实我还写了个基于[Opennext](https://opennext.js.org/cloudflare)的版本, 但是它的`getCloudflareContext` 函数貌似有点问题, 导致cron任务获取DB时会报错, 折腾了好久都不行就暂时把仓库private了, 等后续Opennext修复了再open出来)

## 界面展示
### dashboard
![dashboard](img/dashboard.png)

### 订阅管理
![subscription](img/subscription.png)

| 新增订阅 | 订阅续费历史 |
|---|---|
| <img src="img/subs-renew-form.png" width="100%"> | <img src="img/subs-renew-history.png" width="100%"> |

### 设置页面
![setting](img/settings.png)

### 

## 部署到 Cloudflare Worker
### 方案A: 点击图标一键部署 (推荐, 步骤最少但是无法同步后续代码更新)
#### 1. 点击图标, 按照引导页完成部署  
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Merack/subflare-vinext)  

##### 部署页面填写参考
注意这里填写的用户名密码是改订阅管理系统登录的用户名密码
![deploy](img/deploy.png)

### 方案B: 通过 GitHub Actions 部署(推荐, 需要获取多个令牌, 但是易于同步后续代码更新)
适合已经 fork 到自己 GitHub 仓库, 希望在 push 后自动部署到 Cloudflare Workers 的场景

#### 1. 准备 Cloudflare 资源
先在 Cloudflare 中创建以下资源, 并记下对应 id:
- D1 数据库 id
- KV Namespace id
- Cloudflare Account ID
- Cloudflare API Token

其中 API Token 需要至少具备 Workers、D1、KV 的相关权限, 用于 GitHub Action 执行部署  
推荐在创建API Token时选择worker模板, 然后再在模板中添加权限: D1, 编辑

#### 2. 在 GitHub 仓库中开启 Actions
fork代码后点击仓库顶部的Actions, 选择开启action

#### 3. 在 GitHub 仓库中配置 Actions Secrets
打开仓库 `Settings` -> `Secrets and variables` -> `Actions`, 新增以下 `Repository secrets`:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `D1_ID`
- `KV_ID`

`.github/workflows/deploy.yml` 会在运行时读取这些 secrets, 并调用 `scripts/fill-wrangler-placeholders.sh` 把它们填充到部署配置里

#### 4. 触发部署
- 在初次fork仓库后请在action页面下选择`Deploy to Cloudflare`, 手动点击 `Run workflow`完成初次部署 (重要!!!)
- 后续使用GitHub 的sync fork 后自动部署新代码

#### 5. 首次部署后的检查
部署完成后, 建议到 GitHub Actions 查看日志, 确认 deploy 步骤成功；再到 Cloudflare Dashboard 中检查 Worker 是否已更新

#### 6. 在Cloudflare worker后台设置用户名密码
进到worker项目后台添加一下变量
- `USERNAME`
- `PASSWORD`

### 方案C: 通过 wrangler 部署 (不推荐, 自定义程度高但是步骤复杂)

#### 1. clone 代码并安装依赖

```
git clone https://github.com/Merack/subflare-vinext.git
cd subflare
pnpm install
```

#### 2. 新建KV和D1数据库
进到Cloudflare 面板中(https://dash.cloudflare.com/), 在左侧菜单中找到KV和D1模块, 新建后记下实例id

#### 3. 修改配置文件

(i) `wrangler.jsonc`主要修改以下字段:
 - d1_databases
 - kv_namespaces

(ii) 将`.env.development.example` 改名为 `.env.development`并按注释完善值

#### 4. 将数据库推送到远程D1

```
pnpm drizzle-kit push
```
或

```
pnpm drizzle-kit migrate
```

#### 5. 部署应用

```bash
pnpm deploy
```
首次deploy可能要求进行登录验证

#### 6. 设置系统登录账户
找到部署的[Cloudflare Worker](https://dash.cloudflare.com/), 在设置页里设置变量和机密:
 - USERNAME
 - PASSWORD


## 特性

- 订阅管理：新增、编辑、删除订阅项目
- 到期提醒：按提前天数和提醒模式发送通知
- 多时段通知：支持按时区配置多个通知时段
- 自动续费处理：订阅到期后可自动推进下一周期并记录历史
- 汇总视图：提供多维度汇总数据, 多国货币汇率自动转换, 年月统计视图切换等
- 通知渠道扩展：通知渠道架构设计为可扩展
- Cloudflare 强力驱动：面向 Cloudflare Workers 运行环境设计

## 技术栈

- Next.js 16（App Router）
- React 19
- Vinext
- Cloudflare Workers
- Cloudflare D1
- Cloudflare KV
- Drizzle ORM
- Tailwind CSS v4
- shadcn/ui

## 项目结构

```text
src/
├─ app/                    # 页面与 API Route
│  ├─ api/                 # 登录、订阅、设置、通知渠道等接口
│  ├─ dashboard/           # 仪表盘页面
│  ├─ subscriptions/       # 订阅管理页面
│  ├─ settings/            # 设置页面
│  └─ login/               # 登录页
├─ components/             # 页面客户端组件与通用 UI 组件
├─ db/                     # D1 数据库入口与 Drizzle Schema
├─ lib/
│  ├─ notifications/       # 通知策略、注册表、描述符、分发器
│  ├─ cron.ts              # 到期提醒定时任务
│  ├─ session.ts           # 基于 KV 的会话逻辑
│  ├─ dashboard.ts         # 仪表盘统计逻辑
│  └─ subscription-utils.ts# 订阅周期相关工具
├─ worker.ts               # Cloudflare Worker 入口
└─ proxy.ts                # Middleware

drizzle/                   # Drizzle 生成的 SQL 迁移文件
public/                    # 静态资源
wrangler.jsonc             # Cloudflare Workers 配置
drizzle.config.ts          # Drizzle 远程 D1 配置
```

## 通知渠道
 - Telegram: [@botfather](https://t.me/BotFather)
 - webhook
 - wecombot(企业微信机器人): [https://developer.work.weixin.qq.com](https://developer.work.weixin.qq.com/document/path/91770)
 - bark: [https://bark.day.app](https://bark.day.app/#/?id=bark)
 - notifyx: [https://www.notifyx.cn/help](https://www.notifyx.cn/help)
 - resend: [https://resend.com](https://resend.com/api-keys)
 - smtp

贡献通知渠道: [new_channel.md](doc/new_channel.md)

## 本地开发

### 安装依赖

```bash
pnpm install
```

### 配置本地环境变量

将以下示例文件重命名后再填写内容：

- `.env.development.example` → `.env.development`
- `.dev.vars.example` → `.dev.vars`

其中：

- `.env.development` 主要用于 `drizzle.config.ts` 读取 Cloudflare 远程 D1 信息
- `.dev.vars` 用于本地运行时变量

### 初始化本地数据库

先按sql文件名前缀数字顺序执行 `drizzle/` 目录中的 SQL 文件到本地 D1, 如：

```bash
pnpm wrangler d1 execute DB --local --file=drizzle/0000_supreme_mister_fear.sql
pnpm wrangler d1 execute DB --local --file=drizzle/0001_broken_spyke.sql
```

如果后续新增了新的 SQL 文件，也需要继续按文件顺序执行

### 启动开发服务

```bash
pnpm dev
```

### 数据库初始化与迁移说明


#### 生成迁移文件

当你修改 `src/db/schema.ts` 后，可以先生成新的 SQL：

```bash
pnpm drizzle-kit generate
```

这一步只会生成 `drizzle/` 下的 SQL 文件，不会自动把变更应用到本地数据库

#### 应用到本地开发数据库

对本地模拟 D1 生效时，应执行：

```bash
pnpm wrangler d1 execute DB --local --file=drizzle/<sql_file_name>.sql
```

例如：

```bash
pnpm wrangler d1 execute DB --local --file=drizzle/0002_xxx.sql
```

#### 应用到远程数据库

远程数据库可以使用以下方式之一：

1. 使用 `pnpm drizzle-kit push` 或者 `pnpm drizzle-kit migrate` 将 schema 变更推送到远程数据库(推荐)
2. 打开 Cloudflare Dashboard 的 D1 控制台，按顺序执行这些 SQL
3. 使用 Wrangler 逐个执行 `drizzle/` 中的 SQL 文件

#### 需要特别注意

- `pnpm drizzle-kit generate`：只生成 SQL
- `pnpm drizzle-kit migrate` / `pnpm drizzle-kit push`：不要把它们当成本地 D1 初始化命令
- 本地开发数据库变更请使用 `pnpm wrangler d1 execute DB --local --file=...`

### 常用命令

```bash
pnpm dev        # 本地开发
pnpm build      # Next.js 构建
pnpm preview    # 构建后在本地以 Cloudflare 运行时预览
pnpm deploy     # 构建并部署到 Cloudflare Workers
pnpm upload     # 构建并上传
pnpm cf-typegen # 生成 Cloudflare 环境类型
```

### 新增通知渠道
示例代码详见: [new_channel.md](doc/new_channel.md)

#### 需要特别注意
- 在本地开发环境下smtp无法正常解析smtp host, 还不清楚什么原因, 如果要对smtp进行相关开发, 请部署到worker环境上验证

### 用户系统设计

- 登录会话基于 Cloudflare KV 实现
- 当前项目按单用户场景设计
- `src/lib/session.ts` 中将用户固定为单用户上下文处理

## 待完善计划
 - 后端API错误提示
 - 农历
 - 数据备份
 - 订阅排序模式
 - ISR缓存优化
 - 消息发送历史查询
 - 自定义发送信息文本
 - 数据库清理(消息发送记录表, 清除过期>一定时间范围的订阅)

## 致谢
Claude, ChatGPT

## 参考

- OpenNext for Cloudflare: https://opennext.js.org/cloudflare
- Vinext: https://github.com/cloudflare/vinext
- Next.js: https://nextjs.org
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Drizzle ORM: https://orm.drizzle.team/
