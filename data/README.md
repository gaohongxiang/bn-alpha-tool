# 空投历史数据说明

## 数据文件

`airdrop-history.json` - 包含所有空投历史数据的JSON文件

`current-airdrop.json` - 包含当前正在进行的空投提醒信息

## 数据字段说明

每条记录包含以下字段：

- `date`: 空投日期 (格式: "2025年XX月XX日")
- `token`: 代币名称 (如: "SIGN", "MILK")
- `points`: 领取积分门槛 (数字)
- `participants`: 参与人数 (数字)
- `amount`: 空投数量 (数字)
- `supplementaryToken`: 补发代币数量 (数字)
- `currentPrice`: 代币价格 (格式: "$0.063")
- `type`: 空投类型 ("alpha" 或 "tge")
- `pointsConsumed`: 是否消耗积分 (布尔值，可选，默认true)

## 计算字段

以下字段会在组件中自动计算，**不需要存储在数据文件中**：

- `currentValue`: 总价值 = (amount + supplementaryToken) × currentPrice
- `revenue`: 单号收益 = 总价值保留两位小数

## 注意事项

1. **不要添加 `currentValue` 和 `revenue` 字段** - 这些字段会在组件中自动计算
2. 计算逻辑：
   - 总价值 = (空投数量 + 补发代币数量) × 代币价格
   - 单号收益 = 总价值保留两位小数

## 添加新数据

要添加新的空投记录，只需在 `airdrop-history.json` 数组中追加新的对象即可：

```json
{
  "date": "2025年06月XX日",
  "token": "新代币名称",
  "points": 积分门槛,
  "participants": 参与人数,
  "amount": 空投数量,
  "supplementaryToken": 补发代币数量,
  "currentPrice": "$价格",
  "type": "alpha",
  "pointsConsumed": true
}
```

**注意：** 如果空投不消耗积分（如免费空投），设置 `"pointsConsumed": false`

## 当前空投数据字段 (current-airdrop.json)

- `token`: 代币名称 (如: "SKATE")
- `amount`: 空投数量 (数字)
- `points`: 领取积分门槛 (数字)
- `startTime`: 开始时间 (格式: "2025-06-09 18:00 (UTC+8)")
- `endTime`: 结束时间 (格式: "2025-06-10 18:00 (UTC+8)")
- `description`: 活动描述 (可选)
- `pointsConsumed`: 是否消耗积分 (布尔值，可选，默认true)

## 更新当前空投信息

要更新当前空投信息，只需要修改 `current-airdrop.json` 文件中的相应字段即可：

```json
[
  {
    "token": "新代币名称",
    "amount": 空投数量,
    "points": 积分门槛,
    "startTime": "2025-06-15 18:00 (UTC+8)",
    "endTime": "2025-06-16 18:00 (UTC+8)",
    "description": "活动描述",
    "pointsConsumed": true
  }
]
```

**注意：** 如果空投不消耗积分（如免费空投），设置 `"pointsConsumed": false`

## 设计优势

- **数据语义清晰**：明确区分"积分门槛"和"积分消耗"两个不同概念
- **向后兼容**：`pointsConsumed` 字段可选，默认值为 `true`，不影响现有数据
- **灵活扩展**：支持各种空投类型（消耗积分、免费领取、特殊活动等）
- **数据与代码分离**：便于维护，避免冗余数据存储
- **类型安全**：支持TypeScript类型检查，减少错误
- **用户友好**：界面清晰显示空投是否消耗积分，避免用户误解
- **易于更新**：新项目出来只需更新JSON文件，无需修改代码

## 使用示例

```json
// 普通消耗积分的空投（默认情况）
{
  "token": "SIGN",
  "points": 65,
  "pointsConsumed": true  // 可省略，默认为true
}

// 免费空投（如SERAPH）
{
  "token": "SERAPH",
  "points": 198,
  "pointsConsumed": false  // 明确标记为免费
}
``` 