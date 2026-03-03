import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:child_process', () => ({
  execFile: vi.fn((_cmd, _args, cb) => cb(null, '', '')),
}))

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
}))

import { execFile } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import {
  reencodeConstantFps,
  generateTitleCard,
  concatSegments,
  composeVideo,
} from '../lib/compositor.js'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('reencodeConstantFps', () => {
  it('calls ffmpeg with correct encoding args', async () => {
    await reencodeConstantFps('input.webm', 'output.mp4')

    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-i', 'input.webm', '-r', '30', '-crf', '18']),
      expect.any(Function)
    )
  })

  it('accepts custom fps and crf', async () => {
    await reencodeConstantFps('in.webm', 'out.mp4', { fps: 60, crf: 23 })

    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-r', '60', '-crf', '23']),
      expect.any(Function)
    )
  })
})

describe('generateTitleCard', () => {
  it('calls ffmpeg with drawtext filter', async () => {
    await generateTitleCard({
      text: 'Hello World',
      output: '/tmp/title.mp4',
    })

    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-vf', expect.stringContaining('drawtext')]),
      expect.any(Function)
    )
  })

  it('uses style colors when provided', async () => {
    await generateTitleCard({
      text: 'Test',
      style: { bgColor: '#ff0000', textColor: '#00ff00' },
      output: '/tmp/title.mp4',
    })

    const args = execFile.mock.calls[0][1]
    const colorInput = args.find((a) => a.includes('color=c='))
    expect(colorInput).toContain('0xff0000')
  })
})

describe('concatSegments', () => {
  it('writes a filelist and calls ffmpeg concat', async () => {
    await concatSegments(['/a.mp4', '/b.mp4'], '/out/final.mp4')

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.filelist.txt'),
      expect.stringContaining("file '/a.mp4'")
    )
    expect(execFile).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-f', 'concat', '-safe', '0']),
      expect.any(Function)
    )
  })
})

describe('composeVideo', () => {
  it('re-encodes segments, generates titles, and concatenates', async () => {
    await composeVideo({
      segments: ['/seg1.webm', '/seg2.webm'],
      titles: [{ text: 'Intro', duration: 3 }],
      output: '/out/demo.mp4',
    })

    // Should call ffmpeg multiple times: 2 re-encodes + 1 title + 1 concat
    expect(execFile).toHaveBeenCalledTimes(4)
  })

  it('works with no titles', async () => {
    await composeVideo({
      segments: ['/seg.webm'],
      output: '/out/demo.mp4',
    })

    // 1 re-encode + 1 concat
    expect(execFile).toHaveBeenCalledTimes(2)
  })
})
