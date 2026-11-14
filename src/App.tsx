import './App.css'

export default function App() {
  return (
    <main>
      <header><a className="wordmark" href="/">tesselate<span>✳</span></a><span className="badge">GPT / PROJECT STARTER</span></header>
      <section className="intro">
        <p className="eyebrow">A VECTOR PATTERN STUDIO</p>
        <h1>One shape.<br />Endless possibility.</h1>
        <p className="description">Draw a motif. Explore its rhythm. Refine the whole pattern through a single shape.</p>
        <p className="status"><span /> Foundation ready · Editor coming next</p>
      </section>
      <section className="principles" aria-label="Product direction">
        <article><span>01 / EXPLORE</span><h2>See the whole as you draw.</h2><p>A focused motif surrounded by a live, repeating context.</p></article>
        <article><span>02 / REFINE</span><h2>Let geometry do the work.</h2><p>Translation, rotation and reflection, controlled precisely.</p></article>
        <article><span>03 / MAKE</span><h2>From experiment to artwork.</h2><p>Planned vector exports, artboards and deterministic variations.</p></article>
      </section>
      <footer><span>WEB FIRST. BUILT FOR CREATIVE EXPLORATION.</span><span>Local development / v0.0.0</span></footer>
    </main>
  )
}
