import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    const { fileName, content } = await request.json()
    
    if (!fileName || !content) {
      return NextResponse.json(
        { error: '缺少文件名或内容' },
        { status: 400 }
      )
    }
    
    // 确保data/log目录存在
    const logDir = join(process.cwd(), 'data', 'log')
    if (!existsSync(logDir)) {
      await mkdir(logDir, { recursive: true })
    }
    
    // 构造完整文件路径
    const filePath = join(logDir, fileName)
    
    // 写入文件
    await writeFile(filePath, content, 'utf-8')
    
    return NextResponse.json({
      success: true,
      filePath: `data/log/${fileName}`,
      message: '日志文件保存成功'
    })
    
  } catch (error) {
    console.error('保存日志文件失败:', error)
    return NextResponse.json(
      { error: '保存日志文件失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
} 