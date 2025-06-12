# Binance Alpha空投工具

binance alpha空投数据分析工具，帮助你轻松管理和分析空投收益，让每一次空投都能获得最大回报。

## ✨ 主要功能

### 🎯 空投历史分析
- **完整记录**：查看所有历史空投的详细数据
- **收益计算**：自动计算每次空投的实际收益
- **趋势分析**：了解积分门槛和收益变化趋势
- **类型识别**：清楚区分消耗积分和免费领取的空投

### 🔢 积分计算器
- **智能预估**：根据钱包余额和交易量计算积分
- **收益预测**：预测15天和30天的潜在收益
- **BSC优势**：BSC链交易自动翻倍计算积分
- **灵活调整**：可自定义积分门槛、空投价值等参数

### ⏰ 实时空投提醒
- **精确倒计时**：显示空投截止时间，精确到秒
- **多空投监控**：同时追踪多个进行中的空投
- **状态更新**：实时显示空投的开始、进行、结束状态

### 💰 钱包收益分析
- **批量分析**：一次性分析多个钱包地址
- **实时数据**：从BSCScan获取最新的余额和交易数据
- **成本计算**：精确计算Gas费用和交易磨损
- **积分评估**：基于真实数据评估钱包积分

## 🚀 为什么选择这个工具？

- **数据准确**：基于官方数据源，确保信息准确性
- **操作简单**：界面直观，无需技术背景即可使用
- **实时更新**：自动同步最新的空投信息和价格数据
- **收益最大化**：帮助你在每次空投中获得最佳回报

## 🎨 界面特色

- **现代设计**：美观的界面设计，使用体验流畅
- **响应式布局**：手机、平板、电脑都能完美显示
- **实时动态**：倒计时、数据更新等实时展示
- **清晰图表**：用图表展示历史趋势，一目了然

## 🛠️ 快速开始

```bash
# 安装依赖
pnpm install

# 启动项目
pnpm dev
```

启动后在浏览器中打开 http://localhost:3000 即可使用。

## 📋 使用说明

1. **查看历史**：在空投历史页面查看所有过往空投数据
2. **计算积分**：使用积分计算器预估你的积分和收益
3. **监控空投**：实时关注当前进行中的空投活动
4. **分析钱包**：导入钱包地址，分析收益情况

## ⚙️ 配置管理

本工具采用按网络组织的配置架构，配置文件位于：`/config/app-config.json`

### 配置结构说明

```json
{
  "networks": {
    "bsc": {
      "name": "BSC Mainnet",
      "chainId": 56,
      "rpcUrls": [
        "https://bsc-dataseed1.binance.org/",
        "https://rpc.ankr.com/bsc"
      ],
      "blockExplorerUrl": "https://bscscan.com",
      
      "tokens": [
        {
          "symbol": "USDT",
          "name": "Tether USD",
          "aliases": ["BSC-USD", "USDT-BSC"],
          "isStableCoin": true,
          "basePrice": 1,
          "address": "0x55d398326f99059fF775485246999027B3197955"
        }
      ],
      
      "pairs": [
        { "from": "USDT", "to": "ZKJ", "description": "USDT买入ZKJ" },
        { "from": "ZKJ", "to": "USDT", "description": "ZKJ卖出换USDT" }
      ],
      
      "rules": {
        "bscVolumeMultiplier": 2,
        "defaultGasPrice": "5000000000"
      },

      "api": {
        "baseUrl": "https://api.bscscan.com/api",
        "keys": [
          { "key": "YOUR_API_KEY", "name": "我的Key", "active": true }
        ]
      }
    }
  },
  
  "defaultNetwork": "bsc"
}
```

### 配置说明

1. **网络配置 (networks)**
   - 按网络ID组织（如 `bsc`、`eth`）
   - 每个网络包含完整的配置信息
   - 支持多链扩展

2. **代币配置 (tokens)**
   - `symbol`: 代币符号
   - `name`: 代币名称  
   - `aliases`: 别名数组（处理不同命名）
   - `isStableCoin`: 是否为稳定币
   - `address`: 合约地址（BNB用"native"）

3. **交易对配置 (pairs)**
   - 列出所有支持的交易方向
   - 系统自动判断是否计入交易量

4. **规则配置 (rules)**
   - `bscVolumeMultiplier`: BSC链交易量倍数
   - Gas费用相关设置

### 如何修改配置

1. **添加新代币**（在对应网络下）：
   ```json
   {
     "symbol": "NEW_TOKEN",
     "name": "New Token",
     "address": "0x1234...5678"
   }
   ```

2. **添加新交易对**：
   ```json
   { "from": "USDT", "to": "NEW_TOKEN", "description": "USDT买入新代币" }
   ```

3. **添加API密钥**：
   ```json
   { "key": "YOUR_API_KEY", "name": "我的API Key", "active": true }
   ```

4. **添加新网络**：
   ```json
   "eth": {
     "name": "Ethereum Mainnet",
     "chainId": 1,
     "tokens": [...],
     "pairs": [...],
     "api": {...}
   }
   ```

### 配置特性

- ✅ **网络隔离**：每个网络的配置独立，避免混淆
- ✅ **一次配置**：代币信息（基本信息+合约地址）只需配置一次
- ✅ **可扩展**：支持添加多个区块链网络
- ✅ **智能判断**：自动识别有效交易对和是否计入交易量
- ✅ **别名支持**：自动处理代币的不同命名方式
- ✅ **动态生效**：修改配置文件后刷新页面即可生效

---

> 让每一次空投都物超所值 💎 