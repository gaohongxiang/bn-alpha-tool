# Binance Alpha空投工具

基于 **Next.js 14** 和 **Prisma Studio** 构建的简洁高效的区块链数据分析工具，专注于空投数据展示分析和零维护数据管理。

## ✨ 主要功能

### 🔢 积分计算器
- **智能预估**：根据钱包余额和交易量计算积分
- **收益预测**：预测15天和30天的潜在收益
- **BSC优势**：BSC链交易自动翻倍计算积分
- **灵活调整**：可自定义积分门槛、空投价值等参数

### 💰 钱包收益分析
- **批量分析**：一次性分析多个钱包地址
- **实时数据**：从 Moralis API 获取最新的余额和交易数据
- **成本计算**：精确计算Gas费用和交易磨损
- **积分评估**：基于真实数据评估钱包积分

### 🎯 空投历史分析
- **完整记录**：查看所有历史空投的详细数据
- **收益计算**：自动计算每次空投的实际收益
- **趋势分析**：了解积分门槛和收益变化趋势，按时间顺序显示
- **类型识别**：清楚区分消耗积分和免费领取的空投
- **图表展示**：历史曲线和数据表格双重展示

### ⏰ 实时空投提醒
- **两阶段空投**：支持优先获取（高积分、长时间）和先到先得（低积分、短时间）两个阶段
- **精确倒计时**：显示当前阶段的截止时间，精确到秒
- **阶段状态**：清楚显示当前处于哪个阶段（优先获取/先到先得）
- **积分门槛**：实时显示当前阶段所需的积分门槛
- **多空投监控**：同时追踪多个进行中的两阶段空投
- **进度可视化**：进度条和阶段标记帮助直观了解空投进度

### 🛠️ 数据管理系统 (Prisma Studio)
- **专业数据管理**：使用 Prisma Studio 进行数据管理，无需维护复杂的前端界面
- **类型安全**：基于 Prisma schema 的完整类型验证和约束
- **零维护成本**：无需维护前端管理代码，专注核心功能
- **开箱即用**：一键启动数据管理界面
- **数据安全**：基于 Supabase 的可靠数据存储

## 🔧 技术栈

- **前端**: Next.js 14, React 18, TypeScript
- **样式**: Tailwind CSS
- **数据库**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Web3 API**: Moralis HTTP API
- **日志系统**: Winston (专业级日志管理)
- **包管理**: pnpm
- **部署**: Vercel

## 🛠️ 快速开始

1. **拉取项目，安装依赖**
```bash
git clone https://github.com/gaohongxiang/bn-alpha-tool.git
cd bn-alpha-tool
pnpm install
```

2. **申请moralis apiKey**
- 访问[moralis](https://moralis.com/), 申请apikey

3. **创建数据库**
- 访问 [Supabase](https://supabase.com/), 并创建新项目, 获取数据库连接字符串

4. **配置环境变量**
- 复制 `.env.example` 为 `.env`
- 填入 MORALIS_API_KEY 、DATABASE_URL 配置

5. **生成 Prisma 客户端**
```bash
pnpm db:generate
```

6. **同步数据库结构到 Supabase**
```bash
pnpm db:push
```

7. **数据导入**
```bash
# 从 JSON 文件导入现有数据到数据库（可选）
pnpm db:import
```

8. **启动前端应用**
```bash
pnpm dev
```

启动后在浏览器中打开 http://localhost:3000 即可使用。

## 🚀 部署到Vercel

[教程: 快速上手 vercel，手把手教你部署上线你的个人项目
](https://www.cnblogs.com/echolun/p/17524216.html)


### 🗄️ 数据管理

#### 🛠️ Prisma Studio（日常数据管理）
```bash
# 启动 Prisma Studio 数据管理界面
pnpm db:studio

# 在浏览器中访问 http://localhost:5555
```
**操作说明**：
- **查看数据**：选择 `Airdrop` 表查看所有空投数据
- **添加数据**：点击 "Add record" 添加新的空投记录
- **编辑数据**：直接点击单元格进行编辑
- **删除数据**：选中记录后点击删除按钮

### 🔄 数据导入导出
```bash
# 数据导入：从最新备份文件导入到数据库（如果数据库是空的，可以先导入之前的数据）
pnpm db:import

# 数据导出：从数据库导出到备份文件(按日期存储)
pnpm db:export

# 列出所有可用的备份文件
pnpm db:list-backups
```
**功能说明**：
- **导入功能**：自动选择最新的备份文件导入到数据库
- **导出功能**：将数据库中的所有空投数据导出到 `data/backups/airdrop-backup-YYYY-MM-DD.json`
- **备份管理**：列出所有可用的备份文件，显示创建时间和文件大小
- **智能重复检查**：导入时自动跳过已存在的记录（基于 token 唯一性）
- **版本控制**：导出的文件按日期命名，支持多版本备份管理

### 🔧 数据库工具
```bash
# 测试数据库连接
pnpm db:test

# 检查重复数据
pnpm db:check

# 数据库迁移（生产环境）
pnpm db:migrate
```

## 📚 技术文档

- 项目技术文档: ARCHITECTURE.md

## 参考项目

- https://bn-alpha-tool.com
- https://new.alphabot.cm/
- https://www.bn-alpha.site
- https://litangdingzhen.me/
- https://alpha-nu-self.vercel.app/
- alpah数据查询：https://dune.com/ethan714/bn-alpha-analysis