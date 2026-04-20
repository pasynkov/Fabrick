const steps = [
  {
    step: '01',
    title: 'Analyze',
    body: 'Run Fabrick in any repo. It extracts endpoints, env vars, dependencies, and key business logic — no source code leaves your machine.',
  },
  {
    step: '02',
    title: 'Store',
    body: 'Structured context is stored in your own infrastructure. You control what\'s kept and what\'s discarded.',
  },
  {
    step: '03',
    title: 'Connect',
    body: 'Every agent, IDE, and AI tool reads from the same shared layer. One update. Every tool aligned — instantly.',
  },
]

export function Solution() {
  return (
    <section id="solution" className="py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-accent-indigo text-sm font-semibold tracking-widest uppercase mb-3">The solution</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            A shared context layer for your entire stack
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Fabrick sits between your codebase and your tools. Extract once. Serve everywhere.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {steps.map((s) => (
            <div key={s.step} className="relative">
              <div className="text-5xl font-bold text-white/5 mb-3">{s.step}</div>
              <h3 className="text-white font-semibold text-xl mb-2">{s.title}</h3>
              <p className="text-gray-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        {/* Visual diagram */}
        <div className="rounded-2xl border border-white/5 bg-surface-1 p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center">
            {['Your codebase', 'Fabrick context layer', 'Agents · IDEs · Tools'].map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-3 flex-1">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl ${
                  i === 1
                    ? 'bg-gradient-to-br from-accent-indigo to-accent-cyan shadow-lg shadow-accent-indigo/20'
                    : 'bg-surface-2 border border-white/5'
                }`}>
                  {i === 0 ? '📁' : i === 1 ? '✦' : '🤖'}
                </div>
                <span className={`text-sm font-medium ${i === 1 ? 'text-white' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
