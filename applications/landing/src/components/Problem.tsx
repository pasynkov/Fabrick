const problems = [
  {
    icon: '⚡',
    title: 'Fragmented knowledge',
    body: 'Your stack lives in a dozen tools. No single agent has the full picture. Every session starts from scratch.',
  },
  {
    icon: '📡',
    title: 'Incomplete communication',
    body: 'Engineers, agents, and AI assistants each see different slices of the same system. Misalignment is the default.',
  },
  {
    icon: '📄',
    title: 'Stale documentation',
    body: 'READMEs lie. Wikis drift. The only truth is the code — but nobody has time to read all of it.',
  },
  {
    icon: '🔌',
    title: 'Disconnected systems',
    body: 'Your IDE, your CI, your AI tools, your agents — none of them share a common understanding of what your system does.',
  },
]

export function Problem() {
  return (
    <section className="py-28 px-6 bg-surface-1">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-accent-cyan text-sm font-semibold tracking-widest uppercase mb-3">The problem</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Your tools don't speak the same language
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Modern software teams run dozens of tools. Each one is smart on its own. None of them know what the others know.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {problems.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-2xl border border-white/5 bg-surface-2 hover:border-white/10 transition-colors duration-200"
            >
              <div className="text-2xl mb-3">{p.icon}</div>
              <h3 className="text-white font-semibold text-lg mb-2">{p.title}</h3>
              <p className="text-gray-400 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
