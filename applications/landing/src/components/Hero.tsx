export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-indigo/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 -translate-x-1/2 w-[400px] h-[400px] bg-accent-cyan/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full border border-accent-indigo/30 bg-accent-indigo/10 text-accent-indigo text-sm font-medium animate-fade-up">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse" />
          Private beta · Join the waitlist
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 animate-fade-up animate-delay-100">
          The{' '}
          <span className="bg-gradient-to-r from-accent-indigo to-accent-cyan bg-clip-text text-transparent">
            choreography layer
          </span>
          <br />
          for modern work.
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up animate-delay-200">
          Fabrick extracts what matters from your codebase and makes it available to every AI agent, every IDE, every tool — without sharing your source code.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-up animate-delay-300">
          <button className="px-8 py-4 rounded-xl bg-accent-indigo hover:bg-accent-indigo-dim transition-colors duration-200 text-white font-semibold text-lg shadow-lg shadow-accent-indigo/20">
            Get Early Access
          </button>
          <a href="#solution" className="px-8 py-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-all duration-200 text-white font-medium text-lg">
            See how it works
          </a>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-gray-600">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
    </section>
  )
}
