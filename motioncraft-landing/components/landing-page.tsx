"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, AudioLines, Blocks, BookOpen, Check, ChevronDown, CirclePlay, Code2,
  Gauge, GraduationCap, Layers3, Menu, MonitorPlay, PenTool, Play, Rocket,
  Send, Sparkles, Users, WandSparkles, X, Youtube, Zap,
} from "lucide-react";

const features = [
  [Blocks, "Animated diagrams", "Turn complex concepts into clear, custom-built visual systems."],
  [WandSparkles, "Automatic scenes", "Your script becomes a purposeful sequence, not a random slideshow."],
  [Sparkles, "Professional transitions", "Motion that guides attention and keeps every beat feeling intentional."],
  [AudioLines, "Natural narration", "Choose a voice and keep timing perfectly synchronized with every scene."],
  [Layers3, "Timeline editor", "Refine pacing, visuals, and emphasis without wrestling with keyframes."],
  [MonitorPlay, "Export in 1080p", "Crisp, production-ready video for YouTube, courses, and product demos."],
  [PenTool, "Script to video", "Start with a rough idea or a finished script. We handle the visual translation."],
  [Gauge, "Fast rendering", "HTML-powered scenes render quickly without sacrificing visual fidelity."],
  [Code2, "HTML graphics", "Sharp, flexible visuals built from real HTML, CSS, and SVG—not stock clips."],
];
const audiences = [
  [Youtube, "YouTubers", "Make explainers that earn attention without weeks in an editor."],
  [GraduationCap, "Educators", "Turn abstract lessons into visuals students can actually remember."],
  [Code2, "Developers", "Explain systems, code, and architecture with technical precision."],
  [Rocket, "Startups", "Ship polished product demos before the next launch or investor update."],
  [BookOpen, "Online teachers", "Build a consistent visual language across your entire course."],
  [Users, "Documentation teams", "Make dense knowledge approachable for customers and teammates."],
];
const demos = [
  ["How Redis Works", "03:18", "redis", "In-memory speed, visually decoded"],
  ["Git, Without the Mystery", "04:42", "git", "Commits, branches, and merges"],
  ["Binary Search", "02:26", "search", "A visual tour of logarithmic speed"],
  ["The TCP Handshake", "03:07", "tcp", "SYN, SYN-ACK, ACK—made simple"],
];
const faqs = [
  ["How is this different from other AI video tools?", "Motioncraft generates original animated infographic scenes with HTML, CSS, and SVG. It does not stitch together stock footage, templates, or talking avatars."],
  ["When will it launch?", "We’re building the first private beta now. Early members will be invited in small groups so their feedback can directly shape the editor and generation quality."],
  ["Will there be a free plan?", "That is the intention. Pricing is still being validated, but early members will receive founding-member benefits and help us make the tradeoffs."],
  ["Can I join the beta?", "Yes. Join the waitlist and tell us how you currently create videos. Detailed responses help us invite the right mix of early creators."],
];
const plans = [
  { name: "Explorer", price: "$9", features: ["10 videos/month", "720p export", "Standard rendering queue", "Community support"] },
  { name: "Creator", price: "$19", popular: true, features: ["50 videos/month", "1080p export", "Faster rendering", "Premium animations", "Priority support"] },
  { name: "Pro", price: "$39", features: ["Unlimited videos (fair usage)", "Highest priority rendering", "Premium animation styles", "Future AI voice upgrades", "Early access to new features"] },
];
const planChoices = [
  ["Explorer", "Explorer", "$9/month"],
  ["Creator", "Creator", "$19/month"],
  ["Pro", "Pro", "$39/month"],
  ["Free plan", "I’d wait for a free plan", ""],
  ["None", "None of these fit my needs", ""],
];
const objections = [
  "I want to see the output quality first.",
  "It's too expensive.",
  "I don't make enough videos.",
  "I already use another tool.",
  "I don't trust a new product yet.",
  "Other",
];
const useCases = [
  ["💻", "Programming & Computer Science"], ["🧠", "AI & Machine Learning"],
  ["📚", "Education & Online Courses"], ["🧪", "Science"], ["📈", "Finance & Investing"],
  ["🚀", "Startup/Product Explainers"], ["📢", "Marketing Videos"], ["🏢", "Company Training"],
  ["🎨", "Design"], ["📱", "Social Media Content"], ["🎥", "YouTube Automation"],
  ["📖", "Documentation"], ["🎮", "Gaming"], ["🌎", "History & Geography"],
  ["🧮", "Mathematics"], ["🎭", "Other"],
];

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: .65, delay, ease: [.22, 1, .36, 1] }}>{children}</motion.div>;
}

function Logo() {
  return <a className="brand" href="#"><span className="brand-mark"><Image src="/logo.png" alt="" width={58} height={58} /></span> motioncraft <span className="beta">PRIVATE BETA</span></a>;
}

function ProductPreview() {
  return (
    <Reveal className="preview-wrap">
      <div className="preview-glow" />
      <div className="preview">
        <div className="window-bar"><div><i/><i/><i/></div><span>redis-explainer.mc</span><button><Play size={11} fill="currentColor"/> Preview</button></div>
        <div className="preview-body">
          <aside><span>PROJECT</span>{["Script", "Scenes", "Assets", "Narration"].map((x, i) => <div className={i === 1 ? "active" : ""} key={x}><em>{i + 1}</em>{x}</div>)}</aside>
          <div className="canvas">
            <div className="canvas-top"><span>Scene 04 / 08</span><span>00:18.4</span></div>
            <div className="video-frame">
              <div className="grid-lines"/><span className="frame-kicker">IN-MEMORY DATA STORE</span><h3>Why is Redis<br/><b>so fast?</b></h3>
              <div className="data-flow"><div>APP</div><i/><div className="redis-node"><Zap size={18}/> REDIS</div><i/><div>DATA</div></div>
              <span className="caption">Data stays close to the CPU, avoiding slow disk access.</span>
            </div>
          </div>
          <div className="inspector"><span>SCENE PROPERTIES</span><label>Layout <b>Data flow</b></label><label>Animation <b>Progressive</b></label><label>Duration <b>4.8 sec</b></label><div className="render-status"><i/><div><b>Ready to render</b><small>1920 × 1080 · 60fps</small></div></div></div>
        </div>
        <div className="timeline"><div className="time-head"><span>Timeline</span><small>00:00 &nbsp; 00:05 &nbsp; 00:10 &nbsp; 00:15 &nbsp; 00:20</small></div><div className="clips">{[1,2,3,4,5].map((x) => <div className={x === 4 ? "selected" : ""} key={x}><span>0{x}</span><i/></div>)}<b/></div></div>
      </div>
      <div className="floating-chip chip-one"><Sparkles size={15}/> 8 scenes generated</div>
      <div className="floating-chip chip-two"><Check size={15}/> Render complete</div>
    </Reveal>
  );
}

function WaitlistForm({ selectedPlan, onPlanChange }: { selectedPlan: string; onPlanChange: (plan: string) => void }) {
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [message, setMessage] = useState("");
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [paymentObjection, setPaymentObjection] = useState("");
  const [firstUseCase, setFirstUseCase] = useState("");
  function toggleUseCase(value: string) {
    setMessage("");
    setSelectedUseCases((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (current.length >= 3) {
        setMessage("You can choose up to 3 use cases.");
        return current;
      }
      return [...current, value];
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!selectedPlan) { setStatus("error"); setMessage("Please choose the plan that best fits you."); return; }
    if (!selectedUseCases.length) { setStatus("error"); setMessage("Please choose at least one primary use case."); return; }
    if (!paymentObjection) { setStatus("error"); setMessage("Please choose your biggest payment objection."); return; }
    setStatus("loading"); setMessage("");
    const form = new FormData(formElement);
    const payload = { ...Object.fromEntries(form), selectedPlan, paymentObjection, primaryUseCases: selectedUseCases };
    const response = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (response.ok) {
      setFirstUseCase(selectedUseCases[0]);
      setStatus("success");
      formElement.reset();
      window.setTimeout(() => {
        document.querySelector("#waitlist")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } else { setStatus("error"); setMessage(data.error); }
  }
  if (status === "success") return <motion.div className="success-card" initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }}><motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", delay: .12 }}><Check/></motion.div><h3>🎉 You’re officially on the waitlist!</h3><p>Thank you for helping shape this product. We’ll use your feedback to build something creators genuinely want.</p><p>Awesome! We’ll make sure <strong>{firstUseCase}</strong> remains one of our highest priorities.</p><small>We’ll reach out as soon as early access becomes available.</small></motion.div>;
  return <form className="waitlist-form" onSubmit={submit}>
    <div className="two-col"><label>Name<input name="name" required minLength={2} placeholder="Your name"/></label><label>Email<input name="email" required type="email" placeholder="Your email"/></label></div>
    <div className="two-col"><label>What best describes you?<span className="select-wrap"><select name="profession" required defaultValue=""><option value="" disabled>Select profession</option>{["YouTuber","Developer","Educator","Student","Startup","Other"].map(x=><option key={x}>{x}</option>)}</select><ChevronDown/></span></label><label>How do you make videos today?<span className="select-wrap"><select name="currentWorkflow" required defaultValue=""><option value="" disabled>Select current workflow</option>{["Manual editing","Canva","After Effects","CapCut","AI tools","Other"].map(x=><option key={x}>{x}</option>)}</select><ChevronDown/></span></label></div>
    <label>What’s the hardest part of making videos?<textarea name="painPoint" required minLength={10} placeholder="Tell us where you lose the most time or creative energy..."/></label>
    <fieldset className="form-group"><legend>What would you primarily use this product for?</legend><p>This helps us build the right features first. <b>Choose up to 3.</b></p><div className="use-case-grid">{useCases.map(([emoji, value]) => { const active = selectedUseCases.includes(value); return <motion.button type="button" aria-pressed={active} className={active ? "use-case-chip selected" : "use-case-chip"} key={value} onClick={() => toggleUseCase(value)} whileTap={{ scale: .97 }} animate={{ scale: active ? 1.025 : 1 }}><span>{emoji}</span>{value}</motion.button>; })}</div>{selectedUseCases.includes("Other") && <motion.label className="other-field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>Tell us what you’d create<input name="primaryUseCaseOther" required placeholder="Your primary use case"/></motion.label>}</fieldset>
    <fieldset className="form-group"><legend>Which plan would you most likely subscribe to if we launched today?</legend><div className="radio-grid plan-radios">{planChoices.map(([value, title, detail]) => <motion.label className={selectedPlan === value ? "radio-card selected" : "radio-card"} animate={{ scale: selectedPlan === value ? 1.018 : 1 }} key={value}><input type="radio" name="selectedPlanChoice" value={value} checked={selectedPlan === value} onChange={() => onPlanChange(value)}/><i>{selectedPlan === value && <span/>}</i><span><b>{title}</b>{detail && <small>{detail}</small>}</span></motion.label>)}</div></fieldset>
    <fieldset className="form-group"><legend>What is the biggest thing preventing you from paying for a tool like this today?</legend><div className="radio-grid objection-radios">{objections.map((value) => <motion.label className={paymentObjection === value ? "radio-card selected" : "radio-card"} animate={{ scale: paymentObjection === value ? 1.012 : 1 }} key={value}><input type="radio" name="paymentObjectionChoice" value={value} checked={paymentObjection === value} onChange={() => setPaymentObjection(value)}/><i>{paymentObjection === value && <span/>}</i><b>{value}</b></motion.label>)}</div>{paymentObjection === "Other" && <motion.label className="other-field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>What’s holding you back?<textarea name="paymentObjectionOther" required minLength={3} placeholder="Tell us in your own words..."/></motion.label>}</fieldset>
    {status === "error" && <p className="form-error">{message}</p>}
    <button type="submit" className="primary-button wide" disabled={status === "loading"}>{status === "loading" ? "Joining..." : <>Join early access <ArrowRight/></>}</button>
    <small className="privacy">No spam. Just thoughtful product updates and your beta invitation.</small>
  </form>;
}

function FeedbackForm() {
  const [done, setDone] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    if (response.ok) { setDone(true); form.reset(); } else setError((await response.json()).error);
  }
  if (done) return <div className="feedback-done"><Check/> Thank you. Your note is now part of the product conversation.</div>;
  return <form className="feedback-form" onSubmit={submit}><div className="two-col"><input name="email" type="email" placeholder="Email (optional)"/><span className="select-wrap"><select name="category" defaultValue="Feature request"><option>Feature request</option><option>Problem I face</option><option>Dream feature</option><option>General feedback</option></select><ChevronDown/></span></div><textarea name="feedback" minLength={10} required placeholder="What would make this indispensable for you?"/>{error && <p className="form-error">{error}</p>}<button className="secondary-button">Send feedback <Send/></button></form>;
}

export default function LandingPage() {
  const [menu, setMenu] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  function choosePlan(plan: string) {
    setSelectedPlan(plan);
    window.setTimeout(() => document.querySelector("#waitlist")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }
  return <main>
    <nav className="nav"><Logo/><div className={menu ? "nav-links open" : "nav-links"}>{["Demo","Features","Use cases","Pricing","FAQ"].map(x=><a key={x} href={`#${x.toLowerCase().replace(" ","-")}`} onClick={()=>setMenu(false)}>{x}</a>)}<a className="nav-cta" href="#waitlist">Get early access <ArrowRight/></a></div><button className="menu-button" onClick={()=>setMenu(!menu)} aria-label="Toggle navigation">{menu?<X/>:<Menu/>}</button></nav>
    <section className="hero"><div className="orb orb-one"/><div className="orb orb-two"/><motion.div className="hero-copy" initial={{ opacity:0,y:24 }} animate={{opacity:1,y:0}} transition={{duration:.7}}><div className="announcement"><span/> Now building the private beta </div><h1>Ideas deserve to be<br/><span>beautifully explained.</span></h1><p>Turn any topic or script into a polished animated infographic video. No stock footage. No avatars. Just visuals built to make ideas click.</p><div className="hero-actions"><a className="primary-button" href="#waitlist">Get early access <ArrowRight/></a><a className="secondary-button" href="#demo"><CirclePlay/> Watch demo</a></div><small><span className="avatar-stack"><i>A</i><i>K</i><i>M</i></span> Join creators shaping the first release</small></motion.div><ProductPreview/></section>
    <section className="contrast section"><Reveal><p className="eyebrow">A BETTER VISUAL LANGUAGE</p><h2>AI video shouldn’t look<br/>like AI video.</h2><p className="section-lead">Most tools assemble content. Motioncraft designs an explanation.</p></Reveal><div className="comparison"><Reveal className="compare-card muted"><span className="card-label">THE STATUS QUO</span><h3>Generic content assembly</h3>{["Recycled stock footage","Talking-head avatars","Rigid, familiar templates"].map(x=><p key={x}><X/>{x}</p>)}<div className="fake-strip"><i/><i/><i/><i/></div></Reveal><Reveal className="compare-card bright" delay={.12}><span className="card-label">MOTIONCRAFT</span><h3>Purpose-built visual stories</h3>{["Animated diagrams that clarify","Dynamic, contextual explanations","Clean technical motion graphics","Original scenes, generated for you"].map(x=><p key={x}><Check/>{x}</p>)}<div className="nodes"><i/><b/><i/><b/><i/></div></Reveal></div></section>
    <section className="demo-section section" id="demo"><Reveal><p className="eyebrow">SEE THE POSSIBILITIES</p><h2>Built for ideas with depth.</h2><p className="section-lead">A glimpse at the stories Motioncraft is being designed to tell.</p></Reveal><div className="demo-grid">{demos.map(([title,duration,type,desc],i)=><Reveal key={title} delay={i*.06}><article className="demo-card"><div className={`demo-thumb ${type}`}><div className="thumb-art">{type==="redis"&&<><b>R</b><i/><i/><i/></>}{type==="git"&&<><span/><span/><span/><b/></>}{type==="search"&&[1,2,3,4,5,6,7].map(x=><i key={x} className={x===4?"hit":""}>{x}</i>)}{type==="tcp"&&<><span>CLIENT</span><i/><i/><i/><span>SERVER</span></>}</div><button aria-label={`Play ${title}`}><Play fill="currentColor"/></button><small>{duration}</small></div><div><span>{desc}</span><h3>{title}</h3></div></article></Reveal>)}</div></section>
    <section className="features section" id="features"><Reveal><p className="eyebrow">FROM THOUGHT TO TIMELINE</p><h2>Everything between your<br/>script and publish.</h2></Reveal><div className="feature-grid">{features.map(([Icon,title,text],i)=><Reveal className="feature-card" key={title as string} delay={(i%3)*.05}><Icon/><h3>{title as string}</h3><p>{text as string}</p></Reveal>)}</div></section>
    <section className="audience section" id="use-cases"><Reveal><p className="eyebrow">MADE FOR EXPLAINERS</p><h2>If you teach, build, or<br/>explain—this is for you.</h2></Reveal><div className="audience-grid">{audiences.map(([Icon,title,text])=><Reveal className="audience-card" key={title as string}><span><Icon/></span><div><h3>{title as string}</h3><p>{text as string}</p></div></Reveal>)}</div></section>
    <section className="pricing section" id="pricing"><Reveal className="pricing-heading"><p className="eyebrow">PROPOSED LAUNCH PRICING</p><h2>A plan for every kind<br/>of storyteller.</h2><p className="section-lead">These are the plans we’re considering for launch. We’d love to know which one best fits your needs.</p></Reveal><div className="pricing-grid">{plans.map((plan, index) => <Reveal key={plan.name} delay={index * .08}><article className={plan.popular ? "plan-card popular" : "plan-card"}>{plan.popular && <span className="popular-badge">MOST POPULAR</span>}<div><h3>{plan.name}</h3><p><strong>{plan.price}</strong><span>/month</span></p></div><ul>{plan.features.map((feature) => <li key={feature}><Check/>{feature}</li>)}</ul><button className={plan.popular ? "primary-button wide" : "secondary-button wide"} onClick={() => choosePlan(plan.name)}>Choose {plan.name} <ArrowRight/></button></article></Reveal>)}</div><Reveal><p className="pricing-note">No payment today. Your choice simply helps us build pricing around real creator needs.</p></Reveal></section>
    <section className="waitlist-section section" id="waitlist"><div><Reveal><p className="eyebrow">YOUR SEAT AT THE TABLE</p><h2>Be there from<br/>the first frame.</h2><p className="section-lead">We’re inviting a small group of thoughtful creators to shape the private beta. Tell us what you make and what gets in your way.</p><div className="trust-note"><Sparkles/><div><b>Built with early members</b><span>Your answers influence what we prioritize next.</span></div></div></Reveal></div><Reveal className="form-card"><WaitlistForm selectedPlan={selectedPlan} onPlanChange={setSelectedPlan}/></Reveal></section>
    <section className="feedback-section section"><Reveal><div><p className="eyebrow">OPEN ROADMAP</p><h2>Help shape what comes next.</h2><p>Have a dream feature, a frustrating workflow, or a strong opinion? We want the honest version.</p></div><FeedbackForm/></Reveal></section>
    <section className="faq section" id="faq"><Reveal><p className="eyebrow">QUESTIONS, ANSWERED</p><h2>The practical details.</h2></Reveal><div className="faq-list">{faqs.map(([q,a],i)=><Reveal key={q} delay={i*.04}><details><summary>{q}<span>+</span></summary><p>{a}</p></details></Reveal>)}</div></section>
    <footer><div><Logo/><p>Beautiful explanations, generated.</p></div><small>© 2026 Motioncraft.</small></footer>
  </main>;
}
