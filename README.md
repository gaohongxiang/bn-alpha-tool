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

## ⚙️ 配置管理

### 📁 配置文件

项目包含两个主要配置文件：

#### 1. 主配置文件 `/public/config/app-config.json`
**作用**：管理代币信息和API密钥

```json
{
  "networks": {
    "bsc": {
      "name": "BSC Mainnet",
      "tokens": [
        {
          "symbol": "xxx",
          "name": "xxx",
          "address": "xxxxxx"
        }
      ],
      "pairs": [
        { "from": "USDT", "to": "xxx", "description": "USDT买入xxx" },
        { "from": "ZKJ", "to": "USDT", "description": "xxx卖出换USDT" }
      ],

      "api": {
        "keys": [
          { "key": "YOUR_API_KEY", "name": "我的Key", "active": true }
        ]
      }
    }
  }
}
```

#### 2. 空投历史文件 `/data/airdrop-history.json`

**作用**：记录过往空投信息，带开始结束时间的币种信息显示在`空投领取提醒`处。

**两阶段空投格式**：
```json
[
  {
    "date": "2025年06月19日",
    "token": "MAT",
    "participants": null,
    "amount": 16,
    "supplementaryToken": 0,
    "currentPrice": "$3.5",
    "type": "alpha",
    "phase1Points": 243,
    "phase2Points": 210,
    "startTime": "2025-06-19 20:00 (UTC+8)",
    "phase1EndTime": "2025-06-20 14:00 (UTC+8)",
    "phase2EndTime": "2025-06-20 20:00 (UTC+8)"
  }
]
```

**注意**：两阶段空投在历史曲线中会以优先获取阶段的积分门槛为准进行趋势分析。

**单阶段空投格式**：
```json
[
  {
    "date": "2025年05月07日",
    "token": "ZKJ",
    "points": 142,
    "participants": 49161,
    "amount": 50,
    "supplementaryToken": 0,
    "currentPrice": "$1.901",
    "type": "alpha",
    "startTime": "2025-05-7 19:00 (UTC+8)",
    "endTime": "2025-05-8 19:00 (UTC+8)"
  }
]
```

## 参考项目

- https://bn-alpha-tool.com
- https://new.alphabot.cm/
- https://www.bn-alpha.site
- https://litangdingzhen.me/
- https://alpha-nu-self.vercel.app/
