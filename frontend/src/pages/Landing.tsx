import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  Sparkles,
  GitBranch,
  Brain,
  Feather,
  Compass,
  ArrowUpRight,
  BookOpen,
  Stars,
} from "lucide-react";
import { Button, Modal } from "../components/ui";
import { BookArt, CoverArt } from "../components/Art";
export const showcases = [
  {
    title: "The Kingdom Between Stars",
    genre: "FANTASY",
    tag: "A kingdom forgotten. A destiny waiting.",
    excerpt:
      "On the night the stars began to fall upward, a letter arrived at your window. It carried no seal, only a small constellation that shifted beneath your fingertips. “The kingdom remembers you,” it read. Outside, a staircase of silver light was forming above the sleeping town.",
    variant: 0,
  },
  {
    title: "The Last Light of Andromeda",
    genre: "SCIENCE FICTION",
    tag: "Some signals were never meant to be found.",
    excerpt:
      "The observatory had been silent for sixty years. Then, at precisely 03:17, its oldest telescope turned toward a patch of sky that contained absolutely nothing. Your receiver crackled. Through the static came your own voice, older and afraid: “Do not answer the next transmission.”",
    variant: 1,
  },
  {
    title: "Whispers of the Moonwood",
    genre: "MYSTERY",
    tag: "Every forest keeps a secret. This one knows yours.",
    excerpt:
      "The trees had learned your name before you learned theirs. Now, at the edge of the Moonwood, each leaf whispered a different version of the same warning. In the clearing stood a door with no wall around it. Someone had left a fresh cup of tea on its doorstep.",
    variant: 2,
  },
];
export default function Landing() {
  const [preview, setPreview] = useState<number | null>(null);
  return (
    <>
      <section className="hero shell">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="eyebrow pill">
            <span className="tiny-star">✦</span> YOUR IMAGINATION. AN ENTIRE
            UNIVERSE.
          </div>
          <h1>
            Every Story
            <br />
            Begins With
            <br />a <em>Spark.</em>
            <span className="heading-star">✧</span>
          </h1>
          <p>
            Step into a universe where your imagination leads and every decision
            changes the story. Shape adventures that remember your choices.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link to="/create">
                <Sparkles size={17} />
                Begin Your Story
                <ArrowRight size={17} />
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <a href="#explore">
                <Compass size={17} />
                Explore Stories
              </a>
            </Button>
          </div>
          <div className="hero-footnote">
            <span className="mini-line" /> Your universe. Your rules. Your
            story.
          </div>
        </motion.div>
        <BookArt />
      </section>
      <div className="promise-strip">
        <div className="shell">
          <span>
            <Sparkles size={15} /> Powered by imagination
          </span>
          <i>✦</i>
          <span>
            <GitBranch size={15} /> Shaped by your choices
          </span>
          <i>✦</i>
          <span>
            <Brain size={15} /> A world that remembers
          </span>
          <i>✦</i>
          <span>
            <BookOpen size={15} /> A story only you can tell
          </span>
        </div>
      </div>
      <section className="section shell" id="features">
        <div className="section-heading">
          <div>
            <div className="eyebrow">MORE THAN A STORY GENERATOR</div>
            <h2>
              A universe that grows <em>with you.</em>
            </h2>
          </div>
          <p>
            You bring the spark. We help it become
            <br className="desktop-break" /> something extraordinary.
          </p>
        </div>
        <div className="feature-grid">
          {[
            {
              icon: Feather,
              title: "Imagination, brought to life",
              text: "Turn a fleeting idea into an original adventure. Choose your world, your characters, and the feeling of every page.",
            },
            {
              icon: GitBranch,
              title: "Every choice leaves a mark",
              text: "Take the unexpected path. Follow your curiosity. Your decisions shape what happens next—and what comes after.",
            },
            {
              icon: Brain,
              title: "Your world remembers",
              text: "Old friends, broken promises, a key you found three chapters ago. Your story carries its history with it.",
            },
          ].map(({ icon: Icon, title, text }, i) => (
            <Link to="/create" className="feature-card" key={title}>
              <span className={`feature-icon icon-${i}`}>
                <Icon size={23} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="feature-link">
                Discover the possibilities <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="section shell explore" id="explore">
        <div className="section-heading">
          <div>
            <div className="eyebrow">A GLIMPSE OF WHAT COULD BE</div>
            <h2>
              Where will your <em>story take you?</em>
            </h2>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/create">
              Create your own universe <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
        <p className="showcase-label">
          Illustrated starter concepts · These excerpts are editorial examples,
          not live AI generations.
        </p>
        <div className="showcase-grid">
          {showcases.map((s, i) => (
            <button
              key={s.title}
              className="showcase-card"
              onClick={() => setPreview(i)}
            >
              <CoverArt variant={s.variant} />
              <div className="showcase-body">
                <span className="genre-label">{s.genre}</span>
                <h3>{s.title}</h3>
                <p>{s.tag}</p>
                <span className="text-link">
                  Step inside <ArrowUpRight size={15} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="closing shell">
        <Stars size={30} />
        <div className="eyebrow">EVERY CHOICE WRITES A NEW CONSTELLATION.</div>
        <h2>
          Your next adventure
          <br />
          is waiting to be <em>written.</em>
        </h2>
        <p>All it takes is a little curiosity. And you.</p>
        <Button asChild>
          <Link to="/create">
            Begin Your Story
            <ArrowRight size={17} />
          </Link>
        </Button>
        <div className="closing-ring" />
      </section>
      <Modal
        open={preview !== null}
        onOpenChange={() => setPreview(null)}
        title={preview !== null ? showcases[preview].title : "Story concept"}
        description="An editorial starter concept. This is not a saved or AI-generated story."
      >
        {preview !== null && (
          <>
            <p className="excerpt">{showcases[preview].excerpt}</p>
            <Button asChild>
              <Link to={`/create?premise=${preview}`}>
                Make this idea your own <ArrowRight size={17} />
              </Link>
            </Button>
          </>
        )}
      </Modal>
    </>
  );
}
