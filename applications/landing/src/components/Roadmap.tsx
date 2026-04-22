const directions = [
  {
    title: 'Always current',
    body: 'Context that evolves with your codebase — not documentation that drifts. Every push updates the shared layer automatically.',
  },
  {
    title: 'Team-aware',
    body: 'A shared understanding across teams, repos, and disciplines. When one part of the system changes, everyone who needs to know — knows.',
  },
  {
    title: 'Agent-native',
    body: 'AI agents as first-class participants, not just tools. They read from the same context, contribute to it, and coordinate through it.',
  },
]

export function Roadmap() {
  return (
    <section className="py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-accent-indigo text-sm font-semibold tracking-widest uppercase mb-3">Where we're going</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Teams and agents,<br />one shared layer
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Today's teams coordinate through documents, tickets, and meetings. Today's AI agents coordinate through context windows and prompts. Neither knows what the other knows.
          </p>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mt-4 leading-relaxed">
            Fabrick is building the layer where both operate together — not as separate workflows, but as participants in the same shared understanding.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {directions.map((d, i) => (
            <div
              key={d.title}
              className="p-6 rounded-2xl border border-white/5 bg-surface-1 hover:border-accent-indigo/20 transition-colors duration-300"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-indigo/30 to-accent-cyan/20 flex items-center justify-center mb-4">
                <span className="text-accent-cyan text-xs font-bold">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">{d.title}</h3>
              <p className="text-gray-400 leading-relaxed text-sm">{d.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
