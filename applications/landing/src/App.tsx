import { Hero } from './components/Hero'
import { Problem } from './components/Problem'
import { Solution } from './components/Solution'
import { Roadmap } from './components/Roadmap'
import { Privacy } from './components/Privacy'
import { Footer } from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen">
      <Hero />
      <Problem />
      <Solution />
      <Roadmap />
      <Privacy />
      <Footer />
    </div>
  )
}
