# 家庭清单

一个真正用得上的家庭记录工具：物资、购物、宝宝用品、家庭待办，一处记清楚。手机可添加到桌面当 App 用，数据存在本地，不联网也能看已缓存的页面。

## 为什么做这个

Agent Lab 那样的技术演示离生活太远。这个项目从真实家庭场景出发：尿不湿还剩几包、洗衣液要不要补、谁负责交物业费——随手记，勾选完成，家人都能看到。

## 功能

- **多清单**：预置「家庭物资 / 购物清单 / 宝宝用品 / 家庭待办」，可新建任意清单
- **条目记录**：名称、数量、分类、负责人、备注，按分类自动分组
- **待补货标记**：快用完的东西打上提醒，顶部汇总数量，一眼看到要买什么
- **筛选**：全部 / 待办 / 待补货 / 已完成，按负责人过滤，关键词搜索
- **勾选完成**：点一下打勾，数据实时保存
- **手机友好**：响应式布局，PWA 可添加到桌面，离线可打开缓存页面

## 快速开始

```bash
# 终端 1：网关（http://localhost:8791）
node gateway/server.cjs

# 终端 2：前端（http://localhost:5174）
npm install
npm run dev
```

Node 22+（内置 `node:sqlite`，无需数据库服务）。数据落 `data/family-lists.db`。

```bash
npm run smoke   # 网关冒烟测试
npm run build   # 类型检查 + 打包
```

## 部署到手机

构建后的 `dist/` 是纯静态站点，但 API 走同源 `/api`，需要网关一起跑。两种方案：

1. **局域网**：`npm run build && npx vite preview --host 0.0.0.0`，手机连同一 WiFi 访问电脑 IP，浏览器菜单「添加到主屏幕」
2. **服务器**：静态文件 + `/api` 反代到网关，HTTPS 下 PWA 体验完整

### 已部署的 HTTPS 站点（Windows Server）

**公网地址：https://www.boringworld.cn** —— 前端页面 + API 同源部署，PWA 可添加到桌面。

架构：

| 组件 | 位置 | 说明 |
|---|---|---|
| HTTPS 服务 | `C:\Users\Administrator\family-lists\https-proxy\` | greenlock-express，80→443 跳转，Let's Encrypt 自动续期 |
| 前端静态文件 | `https-proxy\dist\` | `npm run build` 产物，同源提供 |
| API 网关 | `C:\Users\Administrator\family-lists\gateway\` | 8791，`/api/*` 由 HTTPS 服务反代 |
| 数据库 | `data\family-lists.db` | 本地 SQLite |

- 自启：计划任务 `FamilyListsHTTPS` + `FamilyListsAPI`（均 `ONSTART`，Administrator 身份）
- 证书配置：`https-proxy/greenlock.d/config.json`，域名 `www.boringworld.cn`
- 应急命令：`schtasks /Run /TN "FamilyListsHTTPS"` / `schtasks /Run /TN "FamilyListsAPI"`
- 查看日志：`https-proxy\proxy.log`

前端 `.env` 的 `VITE_API_BASE` 保持留空（同源 `/api`），仅分域部署时才填完整地址。

Linux 服务器可用 `deploy/setup-server.sh`（systemd 托管），用法见脚本注释。

## 技术栈

Node 22 内置 `http` + `node:sqlite`（零依赖网关）· React 19 + TypeScript + Vite · PWA。

没有登录、没有云同步——刻意保持简单。数据是自己家的，存本机最踏实。
