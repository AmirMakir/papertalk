# Facts: Building always-on agents

Source: "Building always-on agents", William Hu (Anthropic), claude.com/resources/articles/building-always-on-agents, 13 Nov 2026.

| Script line | Quote | Section |
|---|---|---|
| 1 | "An always-on agent is not actually “always on.”" | The cycle behind the always-on agent |
| 2 | "the agent spends most of its time asleep, waking up periodically to do work" | The cycle behind the always-on agent |
| 4 | "Each stretch of work is called a run: the agent receives an event, completes its task, and then saves information about what happened." | The cycle behind the always-on agent |
| 5 | "five core primitives: an event inbox, timers, memory, permissions, and an outbox" | The core primitives |
| 6 | "always-on agents can be triggered by many types of events, including webhooks, scheduled tasks, and background jobs" · "Instead of calling the agent, every source sends an event to an inbox, where a worker picks it up." | Event inbox |
| 7 | "two events arriving at the same time can start competing runs, and a crash can lose an event entirely" · "An inbox should only have one active worker at a time." | Event inbox |
| 8 | "A follow-up is a deadline that the agent sets for itself… A schedule… is a recurring task that happens on a known cadence, such as a daily newsletter." | Timers |
| 9 | "A timer doesn’t initiate a run on its own." · the scheduler "Adds an event to the inbox and wakes the worker." | Timers |
| 10 | "Always-on agents work across many disjointed runs and rely on memory to maintain continuity." · user instructions, user notes, past messages, task progress | Memory |
| 11 | "memory should only hold what the agent can’t look up again… you should save a pointer instead" | Memory |
| 12 | "Permissions are where always-on agents carry the most risk. A run holds the user’s access and, by design, operates unattended." | Permissions |
| 13 | "decide whether to proceed on its own, block it, or wait for approval" · "When a call is deferred, the run ends… their answer comes back as an event in the inbox." | Permissions |
| 14 | "The user gets the outcome and a few details, rather than the entire step-by-step breakdown." | Outbox |
| 15 | "A run can end in one of three ways" (a message, nothing, a deferred call) · "it’s better for the agent to start quiet and then earn more of the user’s attention over time" | Outbox |
| 16–17 | "Each run is brief, but the cycle keeps going indefinitely, and that’s what makes the agent feel like it’s always on." | How everything fits together |
