// Game flow. Each chamber has a few subjects; for each one the student builds
// the molecule, names its shape, then answers one more question about it.
// Solving a subject knocks over a turret; finishing a chamber shows its code.

import { createWorld } from './scene.js';
import { BOND, LONE, electronGeometry } from './vsepr.js';
import { CONFIG, ELEMENTS, CHAMBERS, LINES } from './content.js';

const $ = (id) => document.getElementById(id);
const card = $('card');
const narrator = $('narrator');
const tally = $('tally');

const state = {
  phase: 'menu', // menu | intro | build | shape | angle | debrief | done
  chamber: 0,
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
const chamber = () => CHAMBERS[state.chamber];
const subject = () => chamber().subjects[state.index];
const say = (text) => { narrator.textContent = text; world?.speak(); };
const sayOnce = (key, text) => { if (!state.said.has(key)) { state.said.add(key); say(text); } };
const shuffled = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Finished chambers are remembered on this device so the menu can tick them off.
const STORE = 'vsepr-chambers-done';
function finished() {
  try { return new Set(JSON.parse(localStorage.getItem(STORE) || '[]')); } catch { return new Set(); }
}
function markFinished(id) {
  try { localStorage.setItem(STORE, JSON.stringify([...finished().add(id)])); } catch { /* private browsing: nothing to remember */ }
}

function strike() {
  state.strikes += 1;
  world.raiseAlarm();
  const flash = $('flash');
  flash.classList.add('on');
  setTimeout(() => flash.classList.remove('on'), 80);
}

// The second question for a subject, with the chamber's defaults filled in.
function secondQuestion(s) {
  const first = s.terminals[0].el;
  const last = s.terminals[s.terminals.length - 1].el;
  const prompt = s.terminals.length === 2
    ? `What is the ${first}–${s.central}–${last} bond angle?`
    : `What is the angle between neighbouring ${first}–${s.central}–${last} bonds?`;
  return { title: 'Bond angle', prompt, options: chamber().angleOptions, ...s.angle };
}

// ---------- rendering ----------

function renderSign() {
  const menu = state.phase === 'menu';
  $('sign-num').textContent = menu ? '··' : chamber().id;
  $('sign-title').textContent = menu ? 'Choose a chamber' : chamber().title;
  $('strike-count').textContent = state.strikes;
  $('strikes').hidden = menu;
  $('pips').innerHTML = menu ? '' : chamber().subjects.map((_, i) => {
    const done = state.phase === 'done' || i < state.index || (i === state.index && state.phase === 'debrief');
    const now = !done && i === state.index && state.phase !== 'intro';
    return `<i class="${done ? 'done' : now ? 'now' : ''}"></i>`;
  }).join('');
}

function renderTally() {
  if (['menu', 'intro', 'done'].includes(state.phase)) { tally.innerHTML = ''; return; }
  const c = world.counts();
  tally.innerHTML = `<span class="bond">Bonds: ${c.bonds}</span><span class="lone">Lone pairs: ${c.lone}</span><span>Domains: ${c.total}</span>`;
}

const feedbackHtml = () => (state.feedback ? `<div class="feedback ${state.feedback.kind}" role="status">${state.feedback.text}</div>` : '');
const heading = (text) => `<h2>Subject ${state.index + 1} of ${chamber().subjects.length}: ${text}</h2>`;

const views = {
  menu: () => {
    const done = finished();
    return `
    <h2>Test chambers</h2>
    <div class="options">
      ${CHAMBERS.map((c, i) => `<button data-act="enter" data-value="${i}"><b>${c.id}</b> · ${c.title}${done.has(c.id) ? ' <span class="tick" aria-label="completed">✓</span>' : ''}<small>${c.subjects.map((s) => s.html).join(', ')}</small></button>`).join('')}
    </div>`;
  },

  intro: () => `
    <h2>Before you begin</h2>
    <p>You will build ${plural(chamber().subjects.length, 'molecule')}, each with ${chamber().domains} electron domains, then answer two questions about each one.</p>
    <ul>
      <li><b>Blue</b> adds a bond with its atom. A double or triple bond still counts as one domain.</li>
      <li><b>Orange</b> adds a lone pair.</li>
      <li>With a mouse you can also click in the chamber for blue and right-click for orange.</li>
      <li>Drag in the chamber to look at the molecule from any side.</li>
      <li>Wrong answers earn a strike and the turrets’ attention.</li>
    </ul>
    <button class="primary" data-act="begin">Begin testing</button>
    <button class="quiet" data-act="menu">All chambers</button>`,

  build: () => {
    const s = subject();
    const c = world.counts();
    return `
    ${heading('build it')}
    <div class="formula">${s.html}<small>${s.name} · central atom: ${ELEMENTS[s.central].name} (${s.central})</small></div>
    <p>Work out the Lewis structure, then give the central atom the right electron domains.</p>
    <div class="row">
      <button class="bond" data-act="bond">Bond <kbd>1</kbd></button>
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

  shape: () => question('name the molecular shape', `What is the molecular shape of ${subject().html}?`, subject().shape),
  angle: () => {
    const q = secondQuestion(subject());
    return question(q.title.toLowerCase(), q.prompt, q.answer);
  },

  debrief: () => {
    const s = subject();
    const last = state.index === chamber().subjects.length - 1;
    const total = s.terminals.length + s.lone;
    return `
    ${heading('results')}
    <div class="formula">${s.html}</div>
    <table class="facts">
      <tr><td>Electron domains</td><td>${total} (${plural(s.terminals.length, 'bond')}, ${plural(s.lone, 'lone pair')})</td></tr>
      <tr><td>Electron-domain geometry</td><td>${electronGeometry(total)}</td></tr>
      <tr><td>Molecular shape</td><td>${s.shape}</td></tr>
      ${s.facts.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
    </table>
    <button class="primary" data-act="next">${last ? 'Finish testing' : 'Next subject'}</button>`;
  },

  done: () => {
    const next = CHAMBERS[state.chamber + 1];
    return `
    <h2>Chamber ${chamber().id} complete</h2>
    <p>Enter this completion code in the Canvas quiz for this chamber:</p>
    <div class="code">${chamber().completionCode}</div>
    <p>You finished with ${plural(state.strikes, 'strike')}. ${state.strikes === 0 ? 'A flawless run.' : 'Run it again to aim for zero.'}</p>
    ${next ? `<button class="primary" data-act="enter" data-value="${state.chamber + 1}">Go to chamber ${next.id}: ${next.title.toLowerCase()}</button>` : ''}
    <div class="row">
      <button class="quiet" data-act="restart">Run this chamber again</button>
      <button class="quiet" data-act="menu">All chambers</button>
    </div>`;
  },
};

function question(title, prompt, answer) {
  return `
    ${heading(title)}
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
  if (phase === 'shape') state.options = shuffled(chamber().shapeOptions);
  if (phase === 'angle') state.options = shuffled(secondQuestion(subject()).options);
  render({ focus: true });
}

// Step through a dark "portal" so the jump between rooms is not jarring.
function enterChamber(i) {
  const fade = $('fade');
  fade.classList.add('on');
  setTimeout(() => {
    state.chamber = i;
    state.index = 0;
    state.strikes = 0;
    state.said = new Set();
    world.enterChamber(chamber());
    document.title = `Test Chamber ${chamber().id}: ${chamber().title}`;
    say(LINES.intro(chamber()));
    go('intro');
    fade.classList.remove('on');
  }, 260);
}

function showMenu() {
  say(LINES.menu);
  go('menu');
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
  state.hintLevel += 1;
  state.feedback = {
    kind: 'hint',
    text: state.hintLevel === 1
      ? 'Count every valence electron in the molecule. Bond each outer atom to the central atom, complete the outer atoms (hydrogen needs only two electrons), then see what is left over for the central atom.'
      : subject().count,
  };
  render();
}

function submitBuild() {
  const s = subject();
  const c = world.counts();
  const bonds = s.terminals.length;
  if (c.bonds === bonds && c.lone === s.lone) {
    say(s.builtLine || LINES.rightBuild);
    go('shape');
    return;
  }
  strike();
  say(LINES.wrongBuild(s));
  let text;
  if (c.bonds !== bonds) {
    const multiple = s.terminals.some((t) => t.order > 1);
    text = `${s.html} has ${plural(bonds, 'atom')} attached to the central atom, so it needs ${plural(bonds, 'bond')}. You have ${plural(c.bonds, 'bond')}.${multiple ? ' A double or triple bond points in one direction, so it is added once.' : ''}`;
  } else {
    state.hintLevel += 1;
    text = `The bonds are right, but the central atom should not have ${plural(c.lone, 'lone pair')}. ${state.hintLevel > 1 ? s.count : 'Count the valence electrons and see how many are left once the outer atoms are complete.'}`;
  }
  state.feedback = { kind: 'bad', text };
  render();
}

function answer(value) {
  const s = subject();
  const isShape = state.phase === 'shape';
  const q = isShape ? { answer: s.shape, why: s.shapeWhy, hints: s.shapeHints } : secondQuestion(s);
  if (value === q.answer) {
    state.solved = true;
    state.feedback = { kind: 'good', text: q.why };
    if (isShape) say(LINES.rightShape);
    else { world.setTurretDisabled(state.index, true); say(LINES.rightAngle); }
    render({ focus: true });
    return;
  }
  strike();
  state.tried.add(value);
  say(LINES.wrongAnswer);
  let fallback = 'Look at the molecule from a few sides, then ask whether any lone pairs change the ideal angle.';
  if (isShape) {
    fallback = s.lone === 0
      ? 'There are no lone pairs on the central atom, so the atoms sit exactly where the electron domains are. Rotate the molecule and count its corners.'
      : 'Name the shape from the positions of the atoms only. The lone pairs are there, but they are not part of the name.';
  }
  state.feedback = { kind: 'bad', text: q.hints?.[value] || fallback };
  render();
}

function next() {
  if (state.index < chamber().subjects.length - 1) { startSubject(state.index + 1); return; }
  world.clear();
  markFinished(chamber().id);
  say(LINES.done);
  go('done');
}

const actions = {
  enter: (el) => enterChamber(Number(el.dataset.value)),
  menu: showMenu,
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
  restart: () => enterChamber(state.chamber),
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

// ?chamber=4 (or 04) opens that chamber, ?chamber=menu opens the list.
function chamberFromLink() {
  const asked = new URLSearchParams(location.search).get('chamber') ?? CONFIG.defaultChamber;
  if (asked === 'menu') return -1;
  const i = CHAMBERS.findIndex((c) => Number(c.id) === Number(asked));
  return i >= 0 ? i : CHAMBERS.findIndex((c) => c.id === CONFIG.defaultChamber);
}

async function start() {
  const loading = $('loading');
  try {
    world = await createWorld($('view'), $('stage'), (f) => { loading.textContent = `Loading the chambers… ${Math.round(f * 100)}%`; });
  } catch (err) {
    loading.textContent = 'The chambers could not be loaded. Check your connection and reload the page.';
    console.error(err);
    return;
  }
  world.onChange(onWorldChange);
  bindCanvasClicks(world.canvas);
  if (new URLSearchParams(location.search).has('debug')) window.chamber = { world, state };

  const first = chamberFromLink();
  state.chamber = Math.max(first, 0);
  world.enterChamber(chamber());
  loading.hidden = true;
  if (first < 0) showMenu();
  else {
    document.title = `Test Chamber ${chamber().id}: ${chamber().title}`;
    say(LINES.intro(chamber()));
    go('intro');
  }
}

start();
