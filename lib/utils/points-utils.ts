/**
 * 积分计算工具类
 */
export class PointsUtils {
  /**
   * 根据余额计算积分
   * @param balance 余额(USD)
   * @returns 积分
   */
  static balance(balance: number): number {
    if (balance >= 100000) return 4  // $100,000以上 → 4积分
    if (balance >= 10000) return 3   // $10,000-$99,999 → 3积分
    if (balance >= 1000) return 2    // $1,000-$9,999 → 2积分
    if (balance >= 100) return 1     // $100-$999 → 1积分
    return 0                         // $100以下 → 0积分
  }

  /**
   * 根据交易量计算积分
   * @param volume 交易量(USD)
   * @returns 积分
   */
  static tradingVolume(volume: number): number {
    if (volume < 2) return 0
    
    // 使用以2为底的对数计算积分
    // 2^1=2→1分, 2^2=4→2分, 2^3=8→3分, 2^4=16→4分, 2^5=32→5分...
    const points = Math.floor(Math.log2(volume))
    
    // 确保积分在合理范围内（最大25分）
    return Math.min(points, 25)
  }

  /**
   * BSC链交易量积分（交易量翻倍后计算）
   * @param volume 交易量(USD)
   * @returns 积分
   */
  static bscTradingVolume(volume: number): number {
    // BSC链：交易量翻倍，然后计算积分
    return this.tradingVolume(volume * 2)
  }

  /**
   * 获取余额积分描述
   * @param balance 余额
   * @returns 描述文本
   */
  static getBalancePointsDescription(balance: number): string {
    const points = this.balance(balance)
    if (points === 0) return "需要$100以上才能获得积分"
    if (points === 1) return "$100-$999区间"
    if (points === 2) return "$1,000-$9,999区间"
    if (points === 3) return "$10,000-$99,999区间"
    if (points === 4) return "$100,000以上区间"
    return "未知区间"
  }

  /**
   * 获取交易量积分描述
   * @param volume 交易量
   * @returns 描述文本
   */
  static getTradingVolumeDescription(volume: number): string {
    const points = this.tradingVolume(volume)
    if (points === 0) return "需要$2以上交易量才能获得积分"
    
    // 计算当前积分对应的最低交易量门槛
    const minVolume = Math.pow(2, points)
    const nextMinVolume = Math.pow(2, points + 1)
    
    return `$${minVolume.toLocaleString()}-$${(nextMinVolume - 1).toLocaleString()} 交易量获得 ${points} 积分`
  }

  /**
   * 获取BSC交易量积分描述
   * @param volume 交易量
   * @returns 描述文本
   */
  static getBSCTradingVolumeDescription(volume: number): string {
    const points = this.bscTradingVolume(volume)
    const doubledVolume = volume * 2
    if (points === 0) return "BSC链需要$1以上交易量才能获得积分（加成后$2）"
    
    return `BSC链：$${volume.toLocaleString()} 交易量加成后为 $${doubledVolume.toLocaleString()}，获得 ${points} 积分`
  }

  /**
   * 计算总积分
   * @param balance 余额
   * @param volume 交易量
   * @param isBSC 是否为BSC链
   * @returns 总积分
   */
  static calculateTotal(balance: number, volume: number, isBSC: boolean = false): number {
    const balancePoints = this.balance(balance)
    const volumePoints = isBSC ? this.bscTradingVolume(volume) : this.tradingVolume(volume)
    return balancePoints + volumePoints
  }

  /**
   * 获取积分等级
   * @param totalPoints 总积分
   * @returns 等级描述
   */
  static getPointsLevel(totalPoints: number): string {
    if (totalPoints >= 10) return "🏆 白金级"
    if (totalPoints >= 7) return "🥇 黄金级"
    if (totalPoints >= 5) return "🥈 白银级"
    if (totalPoints >= 3) return "🥉 青铜级"
    if (totalPoints >= 1) return "⭐ 新手级"
    return "🚫 无积分"
  }

  /**
   * 预估收益
   * @param points 积分
   * @param airdropValue 空投价值
   * @param days 天数
   * @returns 预估收益
   */
  static estimateRevenue(points: number, airdropValue: number = 100, days: number = 15): number {
    if (points <= 0) return 0
    
    // 简单的收益计算：积分 * 空投价值 * 天数系数
    const dailyRate = 0.02 // 2%日收益率
    return points * airdropValue * dailyRate * days
  }
} 