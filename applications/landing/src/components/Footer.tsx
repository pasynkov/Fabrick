export function Footer() {
  return (
    <footer className="py-16 px-6 border-t border-white/5">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-accent-indigo to-accent-cyan bg-clip-text text-transparent">
            fabrick
          </span>
          <span className="text-gray-600 text-sm">.me</span>
        </div>
        <p className="text-gray-500 text-sm text-center">
          Shared context for AI agents, IDEs, and teams.
        </p>
        <p className="text-gray-600 text-sm">
          © {new Date().getFullYear()} Fabrick
        </p>
      </div>
    </footer>
  )
}
