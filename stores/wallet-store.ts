import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Wallet, WalletData } from '@/types'

interface WalletStore {
  // 钱包列表
  wallets: Wallet[]
  setWallets: (wallets: Wallet[]) => void
  addWallet: (wallet: Wallet) => void
  removeWallet: (address: string) => void
  
  // 钱包数据
  walletData: WalletData[]
  setWalletData: (data: WalletData[]) => void
  updateWalletData: (address: string, data: Partial<WalletData>) => void
  
  // 查询状态
  hasQueried: boolean
  setHasQueried: (hasQueried: boolean) => void
  
  // 加载状态
  isLoading: boolean
  setIsLoading: (isLoading: boolean) => void
  
  // 错误状态
  error: string | null
  setError: (error: string | null) => void
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      // 初始状态
      wallets: [],
      walletData: [],
      hasQueried: false,
      isLoading: false,
      error: null,

      // 钱包管理
      setWallets: (wallets: Wallet[]) => set({ wallets }),
      
      addWallet: (wallet: Wallet) => set((state) => ({
        wallets: [...state.wallets, wallet]
      })),
      
      removeWallet: (address: string) => set((state) => ({
        wallets: state.wallets.filter(w => w.address !== address),
        walletData: state.walletData.filter(w => w.address !== address)
      })),

      // 钱包数据管理
      setWalletData: (walletData: WalletData[]) => set({ walletData }),
      
      updateWalletData: (address: string, data: Partial<WalletData>) => set((state) => ({
        walletData: state.walletData.map(w => 
          w.address === address ? { ...w, ...data } : w
        )
      })),

      // 状态管理
      setHasQueried: (hasQueried: boolean) => set({ hasQueried }),
      setIsLoading: (isLoading: boolean) => set({ isLoading }),
      setError: (error: string | null) => set({ error })
    }),
    {
      name: 'wallet-store',
      storage: createJSONStorage(() => localStorage),
      // 只持久化钱包列表，不持久化数据和状态
      partialize: (state) => ({
        wallets: state.wallets
      })
    }
  )
) 