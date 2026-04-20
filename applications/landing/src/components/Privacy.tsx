const stored = [
  'API endpoint shapes and HTTP methods',
  'Environment variable names',
  'Dependency names and versions',
  'Business logic descriptions (AI-generated)',
  'Service relationships and integration patterns',
]

const notStored = [
  'Source code',
  'Secret values or credentials',
  'Proprietary business logic verbatim',
  'Personal data',
  'Database contents',
]

export function Privacy() {
  return (
    <section className="py-28 px-6 bg-surface-1">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-accent-cyan text-sm font-semibold tracking-widest uppercase mb-3">Privacy-first</p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Your code stays yours
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Fabrick extracts structure and semantics — never raw source. You decide what context gets stored and where.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* What Fabrick stores */}
          <div className="p-6 rounded-2xl border border-accent-indigo/20 bg-accent-indigo/5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-5 h-5 rounded-full bg-accent-indigo flex items-center justify-center text-white text-xs">✓</div>
              <h3 className="text-white font-semibold text-lg">What Fabrick stores</h3>
            </div>
            <ul className="space-y-3">
              {stored.map((item) => (
                <li key={item} className="flex items-start gap-2 text-gray-300 text-sm">
                  <span className="text-accent-indigo mt-0.5 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* What Fabrick never stores */}
          <div className="p-6 rounded-2xl border border-white/5 bg-surface-2">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-gray-400 text-xs">✕</div>
              <h3 className="text-white font-semibold text-lg">What Fabrick never stores</h3>
            </div>
            <ul className="space-y-3">
              {notStored.map((item) => (
                <li key={item} className="flex items-start gap-2 text-gray-400 text-sm">
                  <span className="text-gray-600 mt-0.5 flex-shrink-0">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm mt-8">
          Analysis runs locally on your machine. Nothing is sent without your explicit push.
        </p>
      </div>
    </section>
  )
}
