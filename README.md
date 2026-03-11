# CloudflareShare

> 基于 Cloudflare Workers、D1 和 R2 的单用户文件存储与分享服务。

前端页面由 Worker 直接输出，文件元数据存储在 D1，文件内容存储在 R2。较大文件上传采用浏览器直传 R2 的方式，避免文件流经过 Worker。

## 功能

- 单用户账号密码登录
- 文件和文件夹上传
- 上传进度显示与取消上传
- 文件下载、删除、批量操作
- 单文件分享
- 单个文件夹使用一个分享密钥进行分享
- 首页通过分享密钥查询并下载文件
- D1 / R2 用量统计与限额设置
- 在线修改管理员密码

## 技术架构

- Worker：路由分发、鉴权、签发直传 URL、写入元数据
- D1：用户、会话、文件元数据、分享信息、用量记录
- R2：文件对象存储
- 前端：内嵌在 Worker 返回的 HTML 中，无额外构建产物

大文件上传流程如下：

1. 前端向 Worker 请求一个直传 R2 的预签名上传地址。
2. 浏览器直接将文件 `PUT` 到 R2。
3. 上传成功后，前端再通知 Worker 写入 D1 元数据。

## 环境要求

- Node.js 18+
- npm
- 已登录 Cloudflare 的 Wrangler CLI

安装 Wrangler：

```bash
npm install -g wrangler
wrangler login
```

安装依赖：

```bash
npm install
```

## 部署

### 1. 创建 D1 数据库

```bash
wrangler d1 create cloudflare-share-db
```

把输出里的 `database_id` 填入 `wrangler.toml`（项目中默认有`wrangler.toml.example`，可重命名为`wrangler.toml`）：

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudflare-share-db"
database_id = "databaseID填入此处"
```

### 2. 创建 R2 存储桶

```bash
wrangler r2 bucket create cloudflare-share-file
```

把桶名填入 `wrangler.toml`：

```toml
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "cloudflare-share-file"
```

### 3. 配置直传 R2 所需变量

浏览器直传 R2 需要 Worker 生成预签名 URL，因此还需要在 `wrangler.toml` 中配置公开变量：

#### （1）找到ID

进入Cloudflare控制台首页，找到如图处即为CF账户ID

![cloudflare-id.png](https://raw.githubusercontent.com/xxmod/CloudflareShare/refs/heads/main/screenshots/cloudflare-id.png "")

#### （2）填写信息到 `wrangler.toml`

添加如下信息到 `wrangler.toml`

```toml
[vars]
R2_ACCOUNT_ID = "CF的账号ID"
R2_BUCKET_NAME = "cloudflare-share-file"
```

说明：

- `R2_ACCOUNT_ID` 是 Cloudflare 账户 ID
- `R2_BUCKET_NAME` 应与 `[[r2_buckets]]` 中的桶名保持一致

### 4. 配置 R2 S3 API Secret

#### (1)找到R2_ACCESS_KEY_ID与R2_SECRET_ACCESS_KEY

##### 进入R2对象存储界面

点击Manage

![cloudflare-id.png](https://raw.githubusercontent.com/xxmod/CloudflareShare/refs/heads/main/screenshots/r2-key-1.png "")

##### 进入API令牌界面

点击创建Account API令牌

![cloudflare-id.png](https://raw.githubusercontent.com/xxmod/CloudflareShare/refs/heads/main/screenshots/r2-key-2.png "")

##### 配置权限

给予管理员读写权限并生成

![cloudflare-id.png](https://raw.githubusercontent.com/xxmod/CloudflareShare/refs/heads/main/screenshots/r2-key-3.png "")

##### 记录R2_ACCESS_KEY_ID与R2_SECRET_ACCESS_KEY

访问密钥ID为R2_ACCESS_KEY_ID
机密访问密钥为R2_SECRET_ACCESS_KEY

![cloudflare-id.png](https://raw.githubusercontent.com/xxmod/CloudflareShare/refs/heads/main/screenshots/r2-key-4.png "")

#### (2)写入secret中

将两个值写入 Worker secrets：

```bash
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```


### 5. 配置 R2 CORS

如果不配置 CORS，浏览器无法直接把文件上传到 R2。

Wrangler CLI 接受的 CORS JSON 结构如下，根目录下给出`r2-cors.json.example`做实例，可更改为`r2-cors.json`：

```json
{
  "rules": [
    {
      "allowed": {
        "origins": [
          "https://your-app.example.com", //此处根据实际情况写，可以填 Worker地址
          "http://localhost:8787"         //也可以加上你配置的自定义域与本地测试地址
        ],
        "methods": [
          "PUT",
          "GET",
          "HEAD"
        ],
        "headers": [
          "*"
        ]
      },
      "exposeHeaders": [
        "ETag"
      ],
      "maxAgeSeconds": 3600
    }
  ]
}
```

保存为一个 JSON 文件后执行：

```bash
wrangler r2 bucket cors set cloudflare-share-file --file ./r2-cors.json
```

查看当前配置：

```bash
wrangler r2 bucket cors list cloudflare-share-file
```

### 6. 部署 Worker

```bash
npm run deploy
```

部署成功后，Wrangler 会输出你的 Worker 地址。

### 7. 初始化管理员账号

首次访问站点时，页面会提示创建管理员账号。

## 本地开发

启动本地开发：

```bash
npm run dev
```

默认访问地址：

```text
http://localhost:8787
```

运行测试：

```bash
npm test
```

## 配置文件示例

仓库包含一个 [wrangler.toml.example](wrangler.toml.example) 可作为参考。

实际使用时，请根据自己的 Cloudflare 资源替换为真实值，不要提交或公开以下信息：

- Cloudflare Account ID
- D1 Database ID
- R2 bucket 名称
- 自定义域名
- R2 API Access Key / Secret Key

## 分享说明

### 分享单文件

登录后，在文件列表点击“分享”，系统会为该文件生成一个分享密钥。

访客可以通过两种方式访问：

- 在首页输入分享密钥
- 访问带密钥的分享链接

### 分享文件夹

文件夹分享只生成一个密钥。

访客输入该密钥后，会看到该文件夹的目录树，并可逐个下载其中的文件。

## 忘记密码 / 重置密码

如果仍然可以登录，优先使用页面右上角的“修改密码”。

如果无法登录，需要手动更新 D1 中的密码哈希。

### 1. 生成新密码的 SHA-256

```bash
node -e "const c=require('crypto');console.log(c.createHash('sha256').update('newpassword').digest('hex'))"
```

### 2. 写入 D1

```bash
wrangler d1 execute <your-d1-name> --remote --command "UPDATE user SET password_hash = '<new-sha256-hash>' WHERE id = 1"
```

也可以在 Cloudflare Dashboard 的 D1 Console 中执行同样的 SQL。

## 目录结构

```text
src/
  auth.js        # 登录、登出、会话、密码修改
  files.js       # 上传、下载、分享、直传签名、元数据登记
  frontend.js    # 前端 HTML / CSS / JS
  index.js       # Worker 入口与路由
  migrate.js     # D1 自动迁移
  usage.js       # 用量统计与限额
  utils.js       # 通用工具函数
test/
  index.test.js  # 集成测试
schema.sql       # 数据结构参考
wrangler.toml    # 实际部署配置
```

## 安全建议

- 不要把真实的 `wrangler.toml`、截图或日志中的账号 ID、数据库 ID、桶名、域名和密钥直接公开
- `R2_ACCESS_KEY_ID` 和 `R2_SECRET_ACCESS_KEY` 只通过 `wrangler secret` 管理
- 分享密钥应视为临时访问凭证，不要长期公开传播
- 修改 R2 CORS 后，如站点使用了缓存或自定义域名，必要时清理缓存再测试
