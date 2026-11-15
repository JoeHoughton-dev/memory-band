declare module 'claude-code' {
  interface PluginState {
    'memory-band': { mem: number | null; cpu: number | null; gpu: number | null; wrappedAt: number }
  }
}
