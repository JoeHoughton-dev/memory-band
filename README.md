# memory-band

A small Claude Code mod that shows how hard your Mac is working: memory, CPU and GPU load as percentages, on the right of the line above the prompt box. It refreshes every five seconds.

```
MEM 61%  CPU 34%  GPU 12%
```

A figure turns yellow at 80% or more (the suggested maximum) and gains a `!` at 90% or more, so the warning never depends on colour alone. Blue and yellow only, so it suits red-green colour blindness.

It reads three standard macOS tools and sends nothing anywhere: `memory_pressure` (memory load is 100 minus the free percentage), `top` (CPU load is 100 minus idle) and `ioreg` (Apple GPU utilisation). It works on macOS only; on other systems nothing is shown. If a figure cannot be read, it is left out.

If you also use a mod called `prompt-master`, the readout joins that mod's row where the two can share a line.

## Install

At the prompt of a terminal session:

```
/plugin install memory-band --marketplace JoeHoughton-dev/memory-band
```

From a shell:

```
claude plugin install memory-band --marketplace JoeHoughton-dev/memory-band
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `JoeHoughton-dev/memory-band`, then Add plugin.

## Settings

The refresh time, the 80% and 90% levels and the colours are named constants at the top of `hooks/register.tsx`.

## Licence

MIT. See `LICENSE`.
