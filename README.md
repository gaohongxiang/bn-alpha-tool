# Binance Alpha空投工具

binance alpha空投数据分析工具，帮助你轻松管理和分析空投收益，让每一次空投都能获得最大回报。

## ✨ 主要功能

### 🔢 积分计算器
- **智能预估**：根据钱包余额和交易量计算积分
- **收益预测**：预测15天和30天的潜在收益
- **BSC优势**：BSC链交易自动翻倍计算积分
- **灵活调整**：可自定义积分门槛、空投价值等参数

### 💰 钱包收益分析
- **批量分析**：一次性分析多个钱包地址
- **实时数据**：从BSCScan获取最新的余额和交易数据
- **成本计算**：精确计算Gas费用和交易磨损
- **积分评估**：基于真实数据评估钱包积分

### 🎯 空投历史分析
- **完整记录**：查看所有历史空投的详细数据
- **收益计算**：自动计算每次空投的实际收益
- **趋势分析**：了解积分门槛和收益变化趋势
- **类型识别**：清楚区分消耗积分和免费领取的空投

### ⏰ 实时空投提醒
- **两阶段空投**：支持优先获取（高积分、长时间）和先到先得（低积分、短时间）两个阶段
- **精确倒计时**：显示当前阶段的截止时间，精确到秒
- **阶段状态**：清楚显示当前处于哪个阶段（优先获取/先到先得）
- **积分门槛**：实时显示当前阶段所需的积分门槛
- **多空投监控**：同时追踪多个进行中的两阶段空投
- **进度可视化**：进度条和阶段标记帮助直观了解空投进度

## 🛠️ 快速开始

```bash
# 安装依赖
pnpm install

# 启动项目
pnpm dev
```

启动后在浏览器中打开 http://localhost:3000 即可使用。

## 🔧 技术栈

- **前端**: Next.js 14, React 18, TypeScript
- **样式**: Tailwind CSS
- **Web3 API**: Moralis HTTP API
- **日志系统**: Winston (专业级日志管理)
- **包管理**: pnpm
- **部署**: Vercel

## 🚀 部署到Vercel

[教程: 快速上手 vercel，手把手教你部署上线你的个人项目
](https://www.cnblogs.com/echolun/p/17524216.html)

### 环境变量配置

在Vercel部署时，需要在项目设置中添加以下环境变量：

```
MORALIS_API_KEY_1=your_moralis_api_key_1
MORALIS_API_KEY_2=your_moralis_api_key_2
MORALIS_API_KEY_3=your_moralis_api_key_3
NODE_ENV=production
```

## ⚙️ 配置

### 🔑 环境变量 (`.env`)

```bash
# Moralis API 密钥（支持多个）
MORALIS_API_KEY_1=your_moralis_api_key_1
MORALIS_API_KEY_2=your_moralis_api_key_2
MORALIS_API_KEY_3=your_moralis_api_key_3
```

### 🎯 零配置智能系统

本项目采用**零配置智能架构**，API参数会根据使用情况自动优化：

- **🧠 智能优化**：根据API密钥数量和分析规模自动调整并发数、批量大小等参数
- **⚡ 开箱即用**：无需手动配置复杂的API参数，系统自动选择最佳配置
- **🚀 性能卓越**：相比传统静态配置，性能提升150-200%

### 📁 配置文件

- **代币配置**：`/public/config/tokens.json` - 管理支持的代币和交易对
- **空投数据**：`/public/data/airdrop-history.json` - 空投历史和提醒数据

## 📚 技术文档

- **[Winston 日志系统](./docs/winston-logging-system.md)** - 专业级日志管理系统详细文档

## 参考项目

- https://bn-alpha-tool.com
- https://new.alphabot.cm/
- https://www.bn-alpha.site
- https://litangdingzhen.me/
- https://alpha-nu-self.vercel.app/
- alpah数据查询：https://dune.com/ethan714/bn-alpha-analysis