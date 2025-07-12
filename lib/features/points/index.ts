/**
 * 积分计算功能模块
 * 负责计算余额积分和交易积分
 */
export class Points {

  /**
   * 根据余额计算积分
   * @param balance 余额(USD)
   * @returns 积分
   */
  static balancePoints(balance: number): number {
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
  static tradingVolumePoints(volume: number): number {
    if (volume < 2) return 0
    
    // 使用以2为底的对数计算积分
    // 2^1=2→1分, 2^2=4→2分, 2^3=8→3分, 2^4=16→4分, 2^5=32→5分...
    const points = Math.floor(Math.log2(volume))
    
    // 确保积分在合理范围内（最大25分）
    return Math.min(points, 25)
  }

  /**
   * 计算总积分
   * @param balance 余额
   * @param volume 交易量
   * @returns 总积分
   */
  static calculateTotalPoints(balance: number, volume: number): number {
    const balancePoints = this.balancePoints(balance)
    const volumePoints = this.tradingVolumePoints(volume)
    return balancePoints + volumePoints
  }
}
