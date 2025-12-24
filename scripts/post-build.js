// 构建后处理脚本
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('执行构建后处理...')

// 读取构建信息
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
)

const buildInfo = {
  version: packageJson.version,
  buildTime: new Date().toISOString(),
  platform: process.platform,
  arch: process.arch,
}

// 创建构建信息文件
const buildInfoPath = path.join(__dirname, '../dist/build-info.json')
fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2))

console.log('构建信息已生成:', buildInfo)
console.log('构建后处理完成！')
