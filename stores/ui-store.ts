import { create } from 'zustand'

interface UIStore {
  // 导航状态
  activeTab: string
  setActiveTab: (tab: string) => void
  
  // 侧边栏状态
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  
  // 主题状态
  theme: 'light' | 'dark' | 'system'
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  
  // 加载遮罩
  globalLoading: boolean
  setGlobalLoading: (loading: boolean) => void
  
  // 通知消息
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
    timestamp: number
  }>
  addNotification: (notification: Omit<UIStore['notifications'][0], 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

export const useUIStore = create<UIStore>((set, get) => ({
  // 初始状态
  activeTab: 'dashboard',
  sidebarOpen: true,
  theme: 'system',
  globalLoading: false,
  notifications: [],

  // 导航管理
  setActiveTab: (tab: string) => set({ activeTab: tab }),

  // 侧边栏管理
  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // 主题管理
  setTheme: (theme: 'light' | 'dark' | 'system') => set({ theme }),

  // 全局加载状态
  setGlobalLoading: (loading: boolean) => set({ globalLoading: loading }),

  // 通知管理
  addNotification: (notification) => {
    const id = Date.now().toString()
    const timestamp = Date.now()
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id, timestamp }
      ]
    }))
    
    // 自动移除通知（5秒后）
    setTimeout(() => {
      get().removeNotification(id)
    }, 5000)
  },

  removeNotification: (id: string) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  clearNotifications: () => set({ notifications: [] })
})) 