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

  /**
   * 计算距离下一个积分等级还需要的交易量
   * @param currentVolume 当前交易量
   * @returns 还需要的交易量，如果已达到最高等级则返回0
   */
  static calculateRemainingVolumeForNextLevel(currentVolume: number): number {
    if (currentVolume < 2) {
      return 2 - currentVolume // 需要达到2才能获得第一个积分
    }
    
    const currentPoints = Math.floor(Math.log2(currentVolume))
    const nextPoints = currentPoints + 1
    
    // 如果已经达到最高等级（25分），返回0
    if (currentPoints >= 25) {
      return 0
    }
    
    const nextVolumeThreshold = Math.pow(2, nextPoints)
    return Math.max(0, nextVolumeThreshold - currentVolume)
  }

  /**
   * 获取下一个积分等级的门槛
   * @param currentVolume 当前交易量
   * @returns 下一个等级的交易量门槛
   */
  static getNextLevelThreshold(currentVolume: number): number {
    if (currentVolume < 2) return 2
    
    const currentPoints = Math.floor(Math.log2(currentVolume))
    const nextPoints = currentPoints + 1
    
    if (currentPoints >= 25) return Math.pow(2, 25) // 最高等级
    
    return Math.pow(2, nextPoints)
  }
}
