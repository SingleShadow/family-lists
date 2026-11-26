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

### 已部署的后端 API（Windows Server）

当前后端跑在 `43.138.34.79:8791`（Windows Server 2025 + Node 26），开机自启：

- 应用目录：`C:\Users\Administrator\family-lists\`（`gateway/` 代码、`data/` 数据库、`start.bat` 启动脚本）
- 自启方式：Windows 计划任务 `FamilyListsAPI`（`ONSTART`，Administrator 身份）
- 公网地址：`http://43.138.34.79:8791`，健康检查 `/api/health`
- 应急命令：`schtasks /Run /TN "FamilyListsAPI"` 手动启动；`taskkill /F /IM node.exe` 停止

前端切到云端只需在 `.env` 设 `VITE_API_BASE=http://43.138.34.79:8791` 后重新构建。网关默认 `CORS=*`，如需收紧改成自己的前端域名。

Linux 服务器可用 `deploy/setup-server.sh`（systemd 托管），用法见脚本注释。

### HTTPS（进行中，待放行 80/443）

用 `https-proxy/` 下的 greenlock-express 做 HTTPS 反代：自动申请并续期 Let's Encrypt 证书，80 端口跳转 HTTPS，443 反代到本机网关 8791。域名 `www.boringworld.cn`，站点配置在 `https-proxy/greenlock.d/config.json`。

前置条件：
- DNS A 记录 `www.boringworld.cn` → `43.138.34.79`（已就绪）
- 安全组放行 `TCP 80` 和 `TCP 443`（**待操作**，证书申请必须走 80 验证）

放行后在服务器执行：
```bat
schtasks /Create /TN "FamilyListsHTTPS" /TR "C:\Users\Administrator\family-lists\https-proxy\start.bat" /SC ONSTART /RU Administrator /F
schtasks /Run /TN "FamilyListsHTTPS"
```
证书自动签发后访问 `https://www.boringworld.cn/api/health` 验证，前端 `.env` 改 `VITE_API_BASE=https://www.boringworld.cn`。

## 技术栈

Node 22 内置 `http` + `node:sqlite`（零依赖网关）· React 19 + TypeScript + Vite · PWA。

没有登录、没有云同步——刻意保持简单。数据是自己家的，存本机最踏实。
