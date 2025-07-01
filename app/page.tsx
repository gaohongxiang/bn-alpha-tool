import { AppShell } from "@/components/layout/app-shell"

/**
 * 主页面 - Server Component
 * 利用Next.js 14的SSR优势，客户端交互委托给AppShell
 */
export default function Home() {
  return <AppShell />
}
