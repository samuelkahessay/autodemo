import { execFile as execFileCb } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFileCb)

export async function reencodeConstantFps(input, output, { fps = 30, crf = 18 } = {}) {
  await mkdir(dirname(output), { recursive: true })
  await exec('ffmpeg', [
    '-i', input,
    '-c:v', 'libx264', '-crf', String(crf), '-preset', 'medium',
    '-r', String(fps), '-vsync', 'cfr',
    '-pix_fmt', 'yuv420p',
    '-an',
    '-movflags', '+faststart',
    '-y', output,
  ])
}

export async function generateTitleCard({ text, style = {}, duration = 3, output }) {
  const bgColor = (style.bgColor || '#1a1a2e').replace('#', '0x')
  const textColor = (style.textColor || 'white').replace('#', '0x')
  const fontSize = style.fontSize || 72

  await mkdir(dirname(output), { recursive: true })

  const escapedText = text.replace(/'/g, "\\'").replace(/:/g, '\\:')
  const vf = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${textColor}:x=(w-text_w)/2:y=(h-text_h)/2`

  await exec('ffmpeg', [
    '-f', 'lavfi',
    '-i', `color=c=${bgColor}:s=1920x1080:d=${duration}:r=30`,
    '-vf', vf,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-t', String(duration),
    '-movflags', '+faststart',
    '-y', output,
  ])
}

export async function concatSegments(segments, output) {
  const listFile = join(dirname(output), '.filelist.txt')
  const content = segments.map((s) => `file '${s}'`).join('\n')
  await writeFile(listFile, content)

  await mkdir(dirname(output), { recursive: true })
  await exec('ffmpeg', [
    '-f', 'concat', '-safe', '0',
    '-i', listFile,
    '-c', 'copy',
    '-movflags', '+faststart',
    '-y', output,
  ])
}

export async function composeVideo({ segments, titles = [], style = {}, output, fps = 30, crf = 18 }) {
  const tmpDir = join(dirname(output), '.autodemo-tmp')
  await mkdir(tmpDir, { recursive: true })

  const reencodedSegments = []
  for (let i = 0; i < segments.length; i++) {
    const reencoded = join(tmpDir, `segment-${i}.mp4`)
    await reencodeConstantFps(segments[i], reencoded, { fps, crf })
    reencodedSegments.push(reencoded)
  }

  const titleCards = []
  for (let i = 0; i < titles.length; i++) {
    const cardPath = join(tmpDir, `title-${i}.mp4`)
    await generateTitleCard({
      text: titles[i].text,
      style,
      duration: titles[i].duration || 3,
      output: cardPath,
    })
    titleCards.push(cardPath)
  }

  // Interleave: title[i] then segment[i]
  const parts = []
  const maxLen = Math.max(titleCards.length, reencodedSegments.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < titleCards.length) parts.push(titleCards[i])
    if (i < reencodedSegments.length) parts.push(reencodedSegments[i])
  }

  await concatSegments(parts, output)
}
