# CloudflareShare

基于 Cloudflare Workers 的个人文件存储与分享服务。使用 D1 数据库存储元数据，R2 对象存储保存文件，纯前端内嵌于 Worker，无需额外托管。

## 功能

- 单用户账号密码登录，Cookie 会话
- 文件 / 文件夹上传、下载、删除
- 批量分享 / 取消分享 / 删除
- 通过**密钥**或**带密钥的链接**分享文件给任意访客
- 每日 / 每月 D1 读写、R2 A/B 类操作及存储空间使用量监控与限额设置
- 黑白简洁 UI，全部功能在同一页面

---

## 部署方法

### 前置要求

- Node.js 18+
- Cloudflare 账号（已登录 `wrangler`）

```bash
npm install -g wrangler
wrangler login
```

---

### 第一步：克隆并安装依赖

```bash
git clone <仓库地址>
cd CloudflareShare
npm install
```

---

### 第二步：创建 D1 数据库

```bash
wrangler d1 create cloudflare-share-db
```

执行后终端会输出类似以下内容：

```
✅ Successfully created DB 'cloudflare-share-db'

[[d1_databases]]
binding = "DB"
database_name = "cloudflare-share-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

修改 `wrangler.toml.example`为 `wrangler.toml`

将输出的 `database_id` 填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudflare-share-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # ← 替换为真实 ID
```

> 数据库表结构由 Worker 在首次请求时自动创建（`IF NOT EXISTS`），无需手动执行 SQL。

---

### 第三步：创建 R2 存储桶

```bash
wrangler r2 bucket create cloudflare-share-bucket
```

将桶名填入 `wrangler.toml`：

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "cloudflare-share-bucket"   # ← 替换为真实桶名
```

---

### 第四步：确认 wrangler.toml

完整的 `wrangler.toml` 示例：

```toml
name = "cloudflare-share"
main = "src/index.js"
compatibility_date = "2026-03-10"

[[d1_databases]]
binding = "DB"
database_name = "cloudflare-share-db"
database_id = "xxxxxxxx-xxxxxx-xxxxx-xxxxx"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "cloudflare-share-bucket"

```

---

### 第五步：部署

```bash
npm run deploy
```

部署成功后输出 Worker 地址，例如：

```
https://cloudflare-share.<your-subdomain>.workers.dev
```

---

### 第六步：初始化账号

首次访问 Worker 地址，页面会自动跳转到账号创建页，设置用户名和密码即可。

---

## 本地开发

```bash
npm run dev
```

启动本地 miniflare 环境，访问 `http://localhost:8787`。

运行测试：

```bash
npm test
```

---

## 分享文件

1. 登录后，在文件列表点击**分享**按钮，系统生成一个 16 位密钥。
2. 点击**分享信息**可查看：
   - **密钥**：供对方在首页右侧输入框直接输入下载。
   - **分享链接**（含密钥）：直接发给对方，打开即可下载。

---

## 忘记密码 / 重置密码

如果仍然可以登录，建议优先使用页面右上角的“修改密码”功能在线更新密码。

系统为单用户，密码以 SHA-256 哈希存储在 D1 数据库中。忘记密码且无法登录时，需通过以下步骤手动重置。

### 第一步：计算新密码的 SHA-256 哈希

在本地终端运行（将 `newpassword` 替换为你想设置的新密码）：

```bash
node -e "const c=require('crypto');console.log(c.createHash('sha256').update('newpassword').digest('hex'))"
```

输出示例：

```
089542505d659cecbb988bb5ccff5bccf85be2dfa8c221359079aee2531298bb
```

### 第二步：将新哈希写入 D1

```bash
wrangler d1 execute cloudflare-share-db --remote --command \
  "UPDATE user SET password_hash = '74c04d93b7b37c08884a8c5f66b9ab70d5551cf77c315f00dfe7e92e5f5cbfa5' WHERE id = 1"
```

> 将单引号内的哈希值替换为上一步实际输出的结果。

执行成功后，使用新密码登录即可。

### 备选：在 Cloudflare Dashboard 执行

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **D1**
2. 选择 `cloudflare-share-db` → 点击 **Console**
3. 执行以下 SQL（替换哈希值）：

```sql
UPDATE user SET password_hash = '089542505d659cecbb988bb5ccff5bccf85be2dfa8c221359079aee2531298bb' WHERE id = 1;
```

---

## 目录结构

```
src/
  index.js      # Worker 入口，路由分发
  auth.js       # 登录 / 登出 / 会话
  files.js      # 文件上传 / 下载 / 分享 / 批量操作
  usage.js      # 用量统计与限额
  migrate.js    # D1 自动建表
  frontend.js   # 内嵌 SPA 前端
  utils.js      # 工具函数
schema.sql      # 数据库结构参考（可选，仅供参考）
wrangler.toml   # Cloudflare 配置
```
