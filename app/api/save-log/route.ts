import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    const { fileName, content, append = false } = await request.json()

    if (!fileName || !content) {
      return NextResponse.json(
        { error: '缺少文件名或内容' },
        { status: 400 }
      )
    }

    // 确保data/runtime/logs目录存在
    const logDir = join(process.cwd(), 'data', 'runtime', 'logs')
    if (!existsSync(logDir)) {
      await mkdir(logDir, { recursive: true })
    }

    // 构造完整文件路径
    const filePath = join(logDir, fileName)

    // 根据append参数决定写入模式
    if (append) {
      // 追加模式：在文件末尾添加内容
      const { appendFile } = await import('fs/promises')
      await appendFile(filePath, content, 'utf-8')
    } else {
      // 覆盖模式：重写整个文件
      await writeFile(filePath, content, 'utf-8')
    }

    return NextResponse.json({
      success: true,
      filePath: `data/runtime/logs/${fileName}`,
      message: append ? '日志内容追加成功' : '日志文件保存成功'
    })

  } catch (error) {
    console.error('保存日志文件失败:', error)
    return NextResponse.json(
      { error: '保存日志文件失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}