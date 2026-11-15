import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

/** How often the figures are read, in milliseconds. */
const REFRESH_MS = 10000
/** Suggested ceiling in percent: from here a figure turns yellow. */
const MAX_SUGGESTED = 80
/** From this load upward a "!" is added, so the warning does not rely on colour alone. */
const CRITICAL = 90
/** Blue and yellow only: safe for red/green colour blindness. */
const COLOUR_NORMAL = '#5aa9ff'
const COLOUR_HIGH = '#f5c518'
/** The plugin whose row this one joins, so both sit on one line. */
const HOST_PLUGIN = 'prompt-master'
/** A merged row seen this recently means the standalone row stays hidden. */
const WRAP_FRESH_MS = 20000

const state = atom({ plugin: 'memory-band', key: 'mem' } as const, null)
const cpuState = atom({ plugin: 'memory-band', key: 'cpu' } as const, null)
const gpuState = atom({ plugin: 'memory-band', key: 'gpu' } as const, null)
const wrappedAt = atom({ plugin: 'memory-band', key: 'wrappedAt' } as const, 0)

const clamp = (n: number): number => Math.min(100, Math.max(0, n))

/** `memory_pressure`: "System-wide memory free percentage: NN%". Load = 100 minus that. */
export function parseMemory(stdout: string): number | null {
  const m = /free percentage:\s*(\d+)%/i.exec(stdout)
  return m ? clamp(100 - Number(m[1])) : null
}

/**
 * `iostat -n 0 -c 2 -w 1`: the last line's `us sy id` columns; load = 100 minus idle.
 * (`top` was tried first and used about 95% of a core on every sample, so it caused the load it measured.)
 */
export function parseCpu(stdout: string): number | null {
  const rows = stdout.trim().split('\n').filter(l => /^\s*\d+\s+\d+\s+\d+\s/.test(l))
  const m = /^\s*\d+\s+\d+\s+(\d+)\s/.exec(rows[rows.length - 1] ?? '')
  return m ? clamp(100 - Number(m[1])) : null
}

/** `ioreg -c AGXAccelerator`: "Device Utilization %"=NN (Apple GPUs). */
export function parseGpu(stdout: string): number | null {
  const m = /"Device Utilization %"\s*=\s*(\d+)/.exec(stdout)
  return m ? clamp(Number(m[1])) : null
}

// The readout, as one run of text and bars, for the shared row or the standalone one.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readout($: any, Text: any) {
  const items: Array<[string, number | null]> = [
    ['MEM', await read($, state)],
    ['CPU', await read($, cpuState)],
    ['GPU', await read($, gpuState)],
  ]
  const shown = items.filter(([, v]) => v !== null) as Array<[string, number]>
  if (shown.length === 0) return null
  return shown.map(([label, v], i) => {
    const colour = v >= MAX_SUGGESTED ? COLOUR_HIGH : COLOUR_NORMAL
    return (
      <Text key={label}>
        <Text dimColor>{i === 0 ? '' : '  '}{label} </Text>
        <Text color={colour}>{String(v)}%{v >= CRITICAL ? '!' : ''}</Text>
      </Text>
    )
  })
}


export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)

    const run = async (argv: string[], timeoutMs: number): Promise<string> => {
      try {
        return (await $.process.run(argv, { timeoutMs })).stdout
      } catch {
        return ''
      }
    }

    const refresh = async () => {
      const [mem, cpu, gpu] = await Promise.all([
        run(['/usr/bin/memory_pressure'], 8000),
        run(['/usr/sbin/iostat', '-n', '0', '-c', '2', '-w', '1'], 10000),
        run(['/usr/sbin/ioreg', '-r', '-d', '1', '-w0', '-c', 'AGXAccelerator'], 5000),
      ])
      const m = parseMemory(mem)
      const c = parseCpu(cpu)
      const g = parseGpu(gpu)
      if (m !== null) await update($, state, () => m)
      if (c !== null) await update($, cpuState, () => c)
      if (g !== null) await update($, gpuState, () => g)
    }

    void refresh()
    $.clock.every(REFRESH_MS, () => {
      void refresh()
    })

    return started
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)

    if (e.plugin === HOST_PLUGIN) {
      // Join the host's own row: its content on the left, the load on the right.
      const row = await next(e)
      const items = await readout($, Text)
      if (row === null || row === undefined || items === null) return row
      await update($, wrappedAt, () => Date.now())
      return (
        <Box justifyContent="space-between" gap={2}>
          {row}
          <Box>{items}</Box>
        </Box>
      )
    }

    // Own row: only when no shared row has been drawn lately.
    const items = await readout($, Text)
    if (items === null) return next(e)
    const last = await read($, wrappedAt)
    if (Date.now() - last < WRAP_FRESH_MS) return next(e)
    return <Box justifyContent="flex-end">{items}</Box>
  })
}
