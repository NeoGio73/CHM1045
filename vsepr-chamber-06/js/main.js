// Game flow: for each subject the student builds the molecule, names its shape,
// then picks its bond angle. Three subjects, three turrets, one completion code.

import { createWorld } from './scene.js';
import { BOND, LONE, electronGeometry } from './vsepr.js';
import { CONFIG, ELEMENTS, SUBJECTS, SHAPE_OPTIONS, ANGLE_OPTIONS, LINES } from './content.js';

const $ = (id) => document.getElementById(id);
const card = $('card');
const narrator = $('narrator');
const tally = $('tally');

const state = {
  phase: 'intro', // intro | build | shape | angle | debrief | done
  index: 0,
  strikes: 0,
  hintLevel: 0,
  feedback: null, // { kind: 'good' | 'bad' | 'hint', text }
  options: [],
  tried: new Set(),
  solved: false,
  said: new Set(),
};

let world = null;
const subject = () => SUBJECTS[state.index];
const say = (text) => { narrator.textContent = text; world?.speak(); };
const sayOnce = (key, text) => { if (!state.said.has(key)) { state.said.add(key); say(text); } };
const shuffled = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function strike() {
  state.strikes += 1;
  world.raiseAlarm();
  const flash = $('flash');
  flash.classList.add('on');
  setTimeout(() => flash.classList.remove('on'), 80);
}

// ---------- rendering ----------

function renderSign() {
  $('sign-num').textContent = CONFIG.chamber;
  $('sign-title').textContent = CONFIG.title;
  $('strike-count').textContent = state.strikes;
  $('pips').innerHTML = SUBJECTS.map((_, i) => {
    const done = state.phase === 'done' || i < state.index || (i === state.index && state.phase === 'debrief');
    const now = !done && i === state.index && state.phase !== 'intro';
    return `<i class="${done ? 'done' : now ? 'now' : ''}"></i>`;
  }).join('');
}

function renderTally() {
  if (state.phase === 'intro' || state.phase === 'done') { tally.innerHTML = ''; return; }
  const c = world.counts();
  tally.innerHTML = `<span class="bond">Bonding pairs: ${c.bonds}</span><span class="lone">Lone pairs: ${c.lone}</span><span>Domains: ${c.total} of ${CONFIG.maxDomains}</span>`;
}

const feedbackHtml = () => (state.feedback ? `<div class="feedback ${state.feedback.kind}" role="status">${state.feedback.text}</div>` : '');

const views = {
  intro: () => `
    <h2>Before you begin</h2>
    <p>You will build three molecules, each with six electron domains, then name the shape and bond angle of each.</p>
    <ul>
      <li><b>Blue</b> adds a bonding pair (with its atom).</li>
      <li><b>Orange</b> adds a lone pair.</li>
      <li>With a mouse you can also click in the chamber for blue and right-click for orange.</li>
      <li>Drag in the chamber to look at the molecule from any side.</li>
      <li>Wrong answers earn a strike and the turrets’ attention.</li>
    </ul>
    <button class="primary" data-act="begin">Begin testing</button>`,

  build: () => {
    const s = subject();
    const c = world.counts();
    return `
    <h2>Subject ${state.index + 1} of ${SUBJECTS.length}: build it</h2>
    <div class="formula">${s.html}<small>${s.name} · central atom: ${ELEMENTS[s.central].name} (${s.central})</small></div>
    <p>Work out the Lewis structure, then give the central atom the right electron domains.</p>
    <div class="row">
      <button class="bond" data-act="bond">Bonding pair <kbd>1</kbd></button>
      <button class="lone" data-act="lone">Lone pair <kbd>2</kbd></button>
    </div>
    <div class="row">
      <button class="quiet" data-act="undo" ${c.total ? '' : 'disabled'}>Undo last</button>
      <button class="quiet" data-act="clear" ${c.total ? '' : 'disabled'}>Remove all</button>
      <button class="quiet" data-act="hint">Hint</button>
    </div>
    ${feedbackHtml()}
    <button class="primary" data-act="submit" ${c.total ? '' : 'disabled'}>Submit for testing</button>`;
  },

  shape: () => question('Name the molecular shape', `What is the molecular shape of ${subject().html}?`, subject().shape),
  angle: () => question('Bond angle', `What is the angle between neighbouring ${subject().terminal}–${subject().central}–${subject().terminal} bonds?`, subject().angle),

  debrief: () => {
    const s = subject();
    const last = state.index === SUBJECTS.length - 1;
    return `
    <h2>Subject ${state.index + 1} of ${SUBJECTS.length}: results</h2>
    <div class="formula">${s.html}</div>
    <table class="facts">
      <tr><td>Electron domains</td><td>${s.bonds + s.lone} (${plural(s.bonds, 'bonding pair')}, ${plural(s.lone, 'lone pair')})</td></tr>
      <tr><td>Electron-domain geometry</td><td>${electronGeometry(s.bonds + s.lone)}</td></tr>
      <tr><td>Molecular shape</td><td>${s.shape}</td></tr>
      ${s.facts.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
    </table>
    <button class="primary" data-act="next">${last ? 'Finish testing' : 'Next subject'}</button>`;
  },

  done: () => `
    <h2>Chamber complete</h2>
    <p>Enter this completion code in the Canvas quiz for this activity:</p>
    <div class="code">${CONFIG.completionCode}</div>
    <p>You finished with ${plural(state.strikes, 'strike')}. ${state.strikes === 0 ? 'A flawless run.' : 'Play again to aim for zero.'}</p>
    <button data-act="restart">Run the chamber again</button>`,
};

function question(title, prompt, answer) {
  return `
    <h2>Subject ${state.index + 1} of ${SUBJECTS.length}: ${title}</h2>
    <div class="formula">${subject().html}</div>
    <p>${prompt}</p>
    <div class="options">
      ${state.options.map((o) => {
        const wrong = state.tried.has(o);
        const right = state.solved && o === answer;
        return `<button data-act="answer" data-value="${o}" class="${wrong ? 'wrong' : right ? 'right' : ''}" ${wrong || state.solved ? 'disabled' : ''}>${o}</button>`;
      }).join('')}
    </div>
    ${feedbackHtml()}
    ${state.solved ? '<button class="primary" data-act="continue">Continue</button>' : ''}`;
}

function render({ focus = false } = {}) {
  renderSign();
  renderTally();
  // Rebuilding the card drops keyboard focus, so put it back on the same control.
  const held = card.contains(document.activeElement) ? document.activeElement.dataset : null;
  card.innerHTML = views[state.phase]();
  const same = held && [...card.querySelectorAll('[data-act]')].find((b) => b.dataset.act === held.act && b.dataset.value === held.value && !b.disabled);
  if (focus) card.querySelector('button.primary, .options button:not(:disabled)')?.focus({ preventScroll: true });
  else if (held) (same || card.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
}

// ---------- flow ----------

function go(phase) {
  state.phase = phase;
  state.feedback = null;
  state.tried = new Set();
  state.solved = false;
  if (phase === 'shape') state.options = shuffled(SHAPE_OPTIONS);
  if (phase === 'angle') state.options = shuffled(ANGLE_OPTIONS);
  render({ focus: true });
}

function startSubject(i) {
  state.index = i;
  state.hintLevel = 0;
  world.setSubject(subject());
  say(LINES.build(subject(), i));
  go('build');
}

function fire(type) {
  if (state.phase !== 'build') return;
  world.fire(type);
}

function giveHint() {
  const s = subject();
  state.hintLevel += 1;
  state.feedback = {
    kind: 'hint',
    text: state.hintLevel === 1
      ? 'Count every valence electron in the molecule. Bond each fluorine to the central atom, fill each fluorine’s octet, then see what is left over for the central atom.'
      : s.count,
  };
  render();
}

function submitBuild() {
  const s = subject();
  const c = world.counts();
  if (c.bonds === s.bonds && c.lone === s.lone) {
    say(s.lone === 2 ? LINES.rightBuildTrans : LINES.rightBuild);
    go('shape');
    return;
  }
  strike();
  say(LINES.wrongBuild(s));
  let text;
  if (c.bonds !== s.bonds) {
    text = `${s.html} has ${plural(s.bonds, 'fluorine atom')}, and each one needs its own bonding pair. You have ${plural(c.bonds, 'bonding pair')}.`;
  } else {
    state.hintLevel += 1;
    text = `The bonding pairs are right, but the central atom should not have ${plural(c.lone, 'lone pair')}. ${state.hintLevel > 1 ? s.count : 'Count the valence electrons and see how many are left after every fluorine has an octet.'}`;
  }
  state.feedback = { kind: 'bad', text };
  render();
}

function answer(value) {
  const s = subject();
  const isShape = state.phase === 'shape';
  const correct = isShape ? s.shape : s.angle;
  if (value === correct) {
    state.solved = true;
    state.feedback = { kind: 'good', text: isShape ? s.shapeWhy : s.angleWhy };
    if (isShape) say(LINES.rightShape);
    else { world.setTurretDisabled(state.index, true); say(LINES.rightAngle); }
    render({ focus: true });
    return;
  }
  strike();
  state.tried.add(value);
  say(LINES.wrongAnswer);
  const hints = isShape ? s.shapeHints : s.angleHints;
  let fallback = 'Six domains point to the corners of an octahedron. Start from the angle between neighbouring corners, then ask whether any lone pairs change it.';
  if (isShape) {
    fallback = s.lone === 0
      ? 'There are no lone pairs on the central atom, so the atoms sit exactly where the six electron domains are. Rotate the molecule and count its corners.'
      : 'Name the shape from the positions of the atoms only. The lone pairs are there, but they are not part of the name.';
  }
  state.feedback = { kind: 'bad', text: hints[value] || fallback };
  render();
}

function next() {
  if (state.index < SUBJECTS.length - 1) { startSubject(state.index + 1); return; }
  world.clear();
  say(LINES.done);
  go('done');
}

function restart() {
  state.strikes = 0;
  state.said = new Set();
  SUBJECTS.forEach((_, i) => world.setTurretDisabled(i, false));
  world.resetView();
  startSubject(0);
}

const actions = {
  begin: () => startSubject(0),
  bond: () => fire(BOND),
  lone: () => fire(LONE),
  undo: () => { if (!world.undo()) say(LINES.empty); },
  clear: () => { if (world.clear()) say(LINES.fizzle); },
  hint: giveHint,
  submit: submitBuild,
  answer: (el) => answer(el.dataset.value),
  continue: () => (state.phase === 'shape' ? go('angle') : (say(LINES.next), go('debrief'))),
  next,
  restart,
};

card.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) actions[el.dataset.act](el);
});

window.addEventListener('keydown', (e) => {
  if (state.phase !== 'build' || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === '1' || k === 'b') fire(BOND);
  else if (k === '2' || k === 'l') fire(LONE);
  else if (k === 'z' || k === 'backspace') actions.undo();
  else return;
  e.preventDefault();
});

function onWorldChange(event) {
  if (state.phase !== 'build') { renderTally(); return; }
  if (event.kind === 'overflow') say(LINES.overflow);
  if (event.kind === 'added') {
    const c = world.counts();
    if (c.total === CONFIG.maxDomains) sayOnce(`full${state.index}`, LINES.full);
    else if (event.shuffled && c.total >= 3) sayOnce('shuffle', LINES.shuffle);
    else if (event.type === BOND) sayOnce('firstBond', LINES.firstBond);
    else sayOnce('firstLone', LINES.firstLone);
  }
  if (state.feedback?.kind === 'bad') state.feedback = null;
  render();
}

// A plain click in the chamber fires blue; a right-click fires orange (mouse only,
// so that dragging to look around on a touch screen never fires by accident).
function bindCanvasClicks(canvas) {
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || e.pointerType !== 'mouse') return;
    const still = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5 && performance.now() - down.t < 400;
    down = null;
    if (!still) return;
    if (e.button === 0) fire(BOND);
    if (e.button === 2) fire(LONE);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

async function start() {
  renderSign();
  say(LINES.intro);
  const loading = $('loading');
  try {
    world = await createWorld($('view'), $('stage'), (f) => { loading.textContent = `Loading the chamber… ${Math.round(f * 100)}%`; });
  } catch (err) {
    loading.textContent = 'The chamber could not be loaded. Check your connection and reload the page.';
    console.error(err);
    return;
  }
  loading.hidden = true;
  world.onChange(onWorldChange);
  bindCanvasClicks(world.canvas);
  if (new URLSearchParams(location.search).has('debug')) window.chamber = { world, state };
  render({ focus: true });
}

start();
