/*
 * Calorimetry and Hess's Law: page logic.
 * The 3D bench (a Unity build in the canvas) runs the heat model and the steps; it sends the page
 * the bench's state and the temperature probe's readings. The page is the logging software (after
 * Logger Pro), the data tables and their checks, the post-lab and the printed report. Work is saved
 * in localStorage under 'calorimetry-lab:v1'.
 */
(function () {
  'use strict';

  var M = window.CalLabModel;
  var STORE_KEY = 'calorimetry-lab:v1';
  var params = new URLSearchParams(window.location.search);
  var standIn = typeof window.CalLabStandIn === 'function' ? window.CalLabStandIn : null;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }
  function fmt(v, p) { return v == null || !isFinite(v) ? '' : (Math.round(v * Math.pow(10, p)) / Math.pow(10, p)).toFixed(p); }

  // ---- saved work ---------------------------------------------------------------------------------

  function blankState(code) {
    return {
      v: 1, code: code || M.randomCode(), name: '', part: 1, bench: null,
      runs: { 1: null, 2: null, 3: null }, settings: { length: '180', rate: '1' },
      entries: {}, flags: {}, flagged: {}, fits: {}, errors: [{ text: '', kind: '' }, { text: '', kind: '' }, { text: '', kind: '' }]
    };
  }
  function loadState() {
    try {
      var s = JSON.parse(window.localStorage.getItem(STORE_KEY));
      if (!s || s.v !== 1 || !M.isCode(s.code)) return null;
      var f = blankState(s.code);
      Object.keys(f).forEach(function (k) { if (s[k] == null) s[k] = f[k]; });
      return s;
    } catch (e) { return null; }
  }
  var saveTimer = 0;
  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private window */ }
    }, 150);
  }
  window.addEventListener('pagehide', function () { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { } });

  var state = loadState();
  var requested = M.normalizeCode(params.get('code') || '');
  if (requested && M.isCode(requested) && (!state || state.code !== requested)) state = blankState(requested);
  if (!state) state = blankState();

  var unity = null, unityReady = false, configured = false;
  var bench = state.bench;             // the latest bench state from Unity
  var collecting = false;

  function sendBench(method, arg) {
    if (!unity || !configured) return false;
    unity.SendMessage('Lab', method, arg == null ? '' : String(arg));
    return true;
  }
  function act(steps) { steps.forEach(function (s) { sendBench('Act', s); }); }

  // ---- the fields --------------------------------------------------------------------------------------

  var PART_NAMES = { 1: 'Part I', 2: 'Part II', 3: 'Part III' };

  function rec(part) { return bench ? (part === 1 ? bench.r1 : part === 2 ? bench.r2 : bench.r3) : null; }
  function run(part) { return state.runs[part]; }

  // a field's accepted value, or null
  var results = {};
  function ok(id) { return results[id] && results[id].ok === true ? M.parseNumber(state.entries[id]) : null; }

  var TABLES = [
    {
      part: 1, title: 'Part I. The calorimeter constant',
      data: [
        { id: 'p1-coldV', label: 'Volume of cold water', unit: 'mL', check: function () { var r = rec(1); return M.checkVolume(state.entries['p1-coldV'], r ? r.coldMl : -1, 'cold water'); } },
        { id: 'p1-coldT', label: 'Temperature of cold water (from your graph, before mixing)', unit: '&deg;C', check: function () { return M.checkStartTemperature(state.entries['p1-coldT'], run(1)); } },
        { id: 'p1-hotV', label: 'Volume of hot water', unit: 'mL', check: function () { var r = rec(1); return M.checkVolume(state.entries['p1-hotV'], r ? r.hotMl : -1, 'hot water'); } },
        { id: 'p1-hotT', label: 'Temperature of hot water (thermometer, just before pouring)', unit: '&deg;C', check: function () { return M.checkHotTemperature(state.entries['p1-hotT'], rec(1)); } }
      ],
      calcs: [
        { id: 'p1-mCold', label: 'Mass of cold water (density 1.00 g/mL)', unit: 'g', expect: function (o) { return o.mCold; }, opts: { abs: 0.051, rel: 0 } },
        { id: 'p1-mHot', label: 'Mass of hot water (density 1.00 g/mL)', unit: 'g', expect: function (o) { return o.mHot; }, opts: { abs: 0.051, rel: 0 } },
        { id: 'p1-tf', label: 'Final temperature, T<sub>f</sub>, by extrapolation', unit: '&deg;C', tf: 1 },
        { id: 'p1-qCold', label: 'q<sub>cw</sub>, heat gained by the cold water (Eqn 2)', unit: 'J', expect: function (o) { return o.qCold; }, opts: { abs: 2, sign: 'The cold water warmed up, so its q is positive: &Delta;T = T<sub>f</sub> &minus; T<sub>i</sub>.' } },
        { id: 'p1-qHot', label: 'q<sub>hw</sub>, heat gained by the hot water (Eqn 2)', unit: 'J', expect: function (o) { return o.qHot; }, opts: { abs: 2, sign: 'The hot water cooled, so its q is negative: &Delta;T = T<sub>f</sub> &minus; T<sub>i</sub>.' } },
        { id: 'p1-qCal', label: 'q<sub>cal</sub> (Eqn 4)', unit: 'J', expect: function (o) { return o.qCal; }, opts: { abs: 3, rel: 0.02, sign: 'From Eqn 4, q<sub>cal</sub> = &minus;(q<sub>hw</sub> + q<sub>cw</sub>).' } },
        { id: 'p1-cCal', label: 'C<sub>cal</sub> (Eqn 3; the cup started at the cold water&rsquo;s temperature)', unit: 'J/&deg;C', expect: function (o) { return o.cCal; }, opts: { abs: 0.6, rel: 0.02, wrong: 'C<sub>cal</sub> = q<sub>cal</sub> / &Delta;T<sub>cal</sub>, and the cup warmed from the cold water&rsquo;s temperature to T<sub>f</sub>.' } }
      ],
      derived: function () { return M.part1({ coldV: ok('p1-coldV'), coldT: ok('p1-coldT'), hotV: ok('p1-hotV'), hotT: ok('p1-hotT'), tf: ok('p1-tf') }); }
    }
  ];
  [2, 3].forEach(function (p) {
    var solid = p === 2 ? 'Mg' : 'MgO', molar = p === 2 ? M.MG_MOLAR : M.MGO_MOLAR, k = 'p' + p + '-';
    TABLES.push({
      part: p, title: (p === 2 ? 'Part II. Enthalpy for Rxn 3: Mg(s) + 2 HCl(aq)' : 'Part III. Enthalpy for Rxn 4: MgO(s) + 2 HCl(aq)'),
      data: [
        { id: k + 'acidV', label: 'Volume of HCl', unit: 'mL', check: function () { var r = rec(p); return M.checkVolume(state.entries[k + 'acidV'], r ? r.acidMl : -1, 'HCl'); } },
        { id: k + 'startT', label: 'Initial temperature of HCl (from your graph)', unit: '&deg;C', check: function () { return M.checkStartTemperature(state.entries[k + 'startT'], run(p)); } },
        { id: k + 'mass', label: 'Mass of ' + solid, unit: 'g', check: function () { return M.checkMass(state.entries[k + 'mass'], rec(p)); } }
      ],
      calcs: [
        { id: k + 'mSoln', label: 'Mass of HCl solution (density 1.00 g/mL)', unit: 'g', expect: function (o) { return o.mSoln; }, opts: { abs: 0.051, rel: 0 } },
        { id: k + 'tf', label: 'Final temperature, T<sub>f</sub>, by extrapolation', unit: '&deg;C', tf: p },
        { id: k + 'dT', label: '&Delta;T<sub>HCl</sub>', unit: '&deg;C', expect: function (o) { return o.dT; }, opts: { abs: 0.011, rel: 0 } },
        { id: k + 'qSoln', label: 'q<sub>HCl</sub> (Eqn 2)', unit: 'J', expect: function (o) { return o.qSoln; }, opts: { abs: 3 } },
        { id: k + 'qCal', label: 'q<sub>cal</sub> (Eqn 3, your C<sub>cal</sub> from Part I)', unit: 'J', expect: function (o) { return o.qCal; }, opts: { abs: 1, waiting: 'This needs your accepted C<sub>cal</sub> from Part I.' } },
        { id: k + 'qRxn', label: 'q<sub>rxn</sub> (Eqn 6)', unit: 'J', expect: function (o) { return o.qRxn; }, opts: { abs: 4, sign: 'The solution warmed, so the reaction gave out heat: q<sub>rxn</sub> = &minus;(q<sub>HCl</sub> + q<sub>cal</sub>).' } },
        { id: k + 'dH', label: '&Delta;H<sub>rxn</sub> per mole of ' + solid + ' (Eqn 7)', unit: 'kJ/mol', expect: function (o) { return o.dH; }, opts: { rel: 0.015, abs: 0.5, factor: 1000, factorText: 'Give it in kJ/mol: divide joules by 1000.', wrong: 'Divide q<sub>rxn</sub> by the moles of ' + solid + ' (its mass over ' + molar + ' g/mol), and give kJ/mol.' } }
      ],
      derived: function () {
        return M.reactionPart({ acidV: ok(k + 'acidV'), startT: ok(k + 'startT'), mass: ok(k + 'mass'), tf: ok(k + 'tf'), cCal: ok('p1-cCal') }, molar);
      }
    });
  });

  var POST = [
    { id: 'post-hess', label: '&Delta;H for Mg(s) + &frac12;O<sub>2</sub>(g) &rarr; MgO(s), from your Rxn 3 and Rxn 4 and Rxn 5 (&minus;285.84 kJ/mol) by Hess&rsquo;s law', unit: 'kJ/mol' },
    { id: 'post-book', label: 'Textbook value: standard enthalpy of formation of MgO(s)', unit: 'kJ/mol' },
    { id: 'post-error', label: 'Percent error (Eqn 11)', unit: '%' }
  ];

  function checkPost(id) {
    var text = state.entries[id];
    var s = M.parseNumber(text);
    if (s === null) return { ok: null, message: '' };
    if (isNaN(s)) return { ok: false, message: 'Type a number only: the unit is printed beside the box.' };
    if (id === 'post-hess') {
      var h = M.hess(ok('p2-dH'), ok('p3-dH'));
      return M.checkCalc(text, h, { rel: 0.005, abs: 0.6, waiting: 'This needs your accepted &Delta;H values from Parts II and III.', wrong: 'Combine Rxn 3, Rxn 4 and Rxn 5 so that they add up to Mg + &frac12;O<sub>2</sub> &rarr; MgO. Reverse a reaction and its &Delta;H changes sign.' });
    }
    if (id === 'post-book') {
      if (s <= -600.9 && s >= -602.0) return { ok: true, message: '' };
      if (s >= 600.9 && s <= 602.0) return { ok: false, message: 'Forming MgO from its elements gives out heat: the value is negative.' };
      return { ok: false, message: 'Look up &Delta;H&deg;<sub>f</sub> of MgO(s) in the table of standard enthalpies of formation in your textbook.' };
    }
    if (id === 'post-error') {
      var pe = M.percentError(ok('post-hess'), ok('post-book'));
      if (pe == null) return { ok: false, message: 'This needs your accepted values above.' };
      if (Math.abs(s - pe) <= 0.15 || Math.abs(s + pe) <= 0.15) return { ok: true, message: '' };
      return { ok: false, message: '% error = (your value &minus; true value) / true value &times; 100.' };
    }
    return { ok: null, message: '' };
  }

  // ---- building the tables -----------------------------------------------------------------------------

  function fieldRow(f, kind) {
    var row = el('div', { 'class': 'row ' + kind });
    var label = el('label', { 'for': f.id, 'class': 'row-label' }, f.label);
    var box = el('span', { 'class': 'row-input' });
    var input = el('input', { type: 'text', id: f.id, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'msg-' + f.id });
    input.value = state.entries[f.id] || '';
    box.appendChild(input);
    box.appendChild(el('span', { 'class': 'unit' }, f.unit));
    row.appendChild(label);
    row.appendChild(box);
    row.appendChild(el('p', { 'class': 'msg', id: 'msg-' + f.id, role: 'status' }));
    input.addEventListener('input', function () {
      state.entries[f.id] = input.value;
      paint(f.id, { ok: null, message: '' });
      saveState();
    });
    input.addEventListener('change', function () { evaluate(f.id); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
    return row;
  }

  function buildTables() {
    var holder = $('tables');
    TABLES.forEach(function (t) {
      var sec = el('section', { 'class': 'table-part', id: 'table-' + t.part, 'aria-label': t.title });
      sec.appendChild(el('h3', null, t.title));
      var g = el('div', { 'class': 'rows' });
      g.appendChild(el('h4', null, 'Data'));
      t.data.forEach(function (f) { g.appendChild(fieldRow(f, 'data')); });
      g.appendChild(el('h4', null, 'Calculations'));
      t.calcs.forEach(function (f) { g.appendChild(fieldRow(f, 'calc')); });
      sec.appendChild(g);
      sec.appendChild(el('textarea', { 'class': 'work', id: 'work-' + t.part, rows: '4', 'aria-label': 'Show your work for ' + PART_NAMES[t.part], placeholder: 'Show your work here (printed with the report).' }));
      holder.appendChild(sec);
      var work = $('work-' + t.part);
      work.value = state.entries['work-' + t.part] || '';
      work.addEventListener('input', function () { state.entries['work-' + t.part] = work.value; saveState(); });
    });

    var post = $('post');
    var g = el('div', { 'class': 'rows' });
    POST.forEach(function (f) { g.appendChild(fieldRow(f, 'calc')); });
    post.appendChild(g);
    post.appendChild(el('h3', null, 'Three sources of error'));
    post.appendChild(el('p', { 'class': 'fine' }, 'Name three sources of error in this experiment and say whether each is systematic or random. Mistakes (gross errors) do not count. These are not checked: your instructor reads them.'));
    state.errors.forEach(function (e, i) {
      var row = el('div', { 'class': 'error-row' });
      var ta = el('textarea', { rows: '2', id: 'err-' + i, 'aria-label': 'Source of error ' + (i + 1) });
      ta.value = e.text;
      var sel = el('select', { id: 'errkind-' + i, 'aria-label': 'Kind of error ' + (i + 1) }, '<option value="">Systematic or random?</option><option value="systematic">Systematic</option><option value="random">Random</option>');
      sel.value = e.kind;
      ta.addEventListener('input', function () { state.errors[i].text = ta.value; saveState(); });
      sel.addEventListener('change', function () { state.errors[i].kind = sel.value; saveState(); });
      row.appendChild(el('span', { 'class': 'error-number' }, String(i + 1) + '.'));
      row.appendChild(ta); row.appendChild(sel);
      post.appendChild(row);
    });
  }

  function paint(id, r) {
    var input = $(id), msg = $('msg-' + id);
    if (!input) return;
    if (r.ok === true) input.setAttribute('data-state', 'ok');
    else if (r.ok === false) input.setAttribute('data-state', 'bad');
    else input.removeAttribute('data-state');
    if (r.ok === false) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    if (msg) msg.innerHTML = r.message || '';
  }

  /** Checks every field in order (later ones use earlier accepted values); counts a wrong answer once per value. */
  function evaluate(changed) {
    results = {};
    TABLES.forEach(function (t) {
      t.data.forEach(function (f) { results[f.id] = f.check(); });
      var o = t.derived();
      t.calcs.forEach(function (f) {
        var text = state.entries[f.id];
        if (f.tf) results[f.id] = M.checkTf(text, run(f.tf));
        else results[f.id] = M.checkCalc(text, f.expect(o), f.opts);
        o = t.derived();
      });
    });
    POST.forEach(function (f) { results[f.id] = checkPost(f.id); });
    Object.keys(results).forEach(function (id) {
      paint(id, results[id]);
      if (id === changed && results[id].ok === false && state.flagged[id] !== state.entries[id]) {
        state.flagged[id] = state.entries[id];
        state.flags[id] = (state.flags[id] || 0) + 1;
      }
    });
    renderSteps();
    updateReportStatus();
    saveState();
  }

  // ---- the steps beside the bench ------------------------------------------------------------------

  function s() { return bench || {}; }
  function settingsRight() { return M.parseNumber(state.settings.length) === 600 && M.parseNumber(state.settings.rate) === 2; }
  function runDone(p) { var r = run(p); return r && r.ended && r.addedAt >= 0; }
  function runHasStart(p) { var r = run(p); return r && r.t.length > 4; }
  function mixed(p) { var r = rec(p); return r && (p === 1 ? r.hotMl > 0 : r.solidG > 0); }

  var STEPS = {
    1: [
      { text: 'Turn on the hot plate under the beaker of water.', acts: ['heat on'], done: function () { return s().heating || mixed(1) || (s().beakerC > (s().beakerC0 || 0) + 30); } },
      { text: 'Put the thermometer in the beaker to watch it warm.', acts: ['take thermometer', 'use beaker'], view: 'thermometer', done: function () { return s().thermoAt !== 'stand' || mixed(1); } },
      { text: 'Measure about 50 mL of cold deionized water in the graduated cylinder.', acts: ['take water', 'use cylinder'], done: function () { var r = rec(1); return s().cylKind === 'cold' || (r && r.coldMl > 0); } },
      { text: 'Read the cylinder to 0.1 mL and record the volume of cold water.', view: 'cylinder', done: function () { return results['p1-coldV'] && results['p1-coldV'].ok; } },
      { text: 'Pour the cold water into the calorimeter.', acts: ['take cylinder', 'use cup'], done: function () { var r = rec(1); return r && r.coldMl > 0; } },
      { text: 'Put the lid on and the temperature probe through its hole.', acts: ['lid on', 'take probe', 'use cup'], done: function () { return (s().probeIn && s().lidOn) || mixed(1); } },
      { text: 'Set Data Collection to 600 s at 2 samples/s.', logger: 'settings', done: settingsRight },
      { text: 'When the beaker reaches 60&ndash;70 &deg;C, turn the hot plate off.', acts: ['heat off'], view: 'thermometer', done: function () { return mixed(1) || (!s().heating && s().beakerC > 50); } },
      { text: 'Measure about 50 mL of the hot water in the cylinder.', acts: ['take beaker', 'use cylinder'], done: function () { return s().cylKind === 'hot' || mixed(1); } },
      { text: 'Read the cylinder and record the volume of hot water.', view: 'cylinder', done: function () { return results['p1-hotV'] && results['p1-hotV'].ok; } },
      { text: 'Put the thermometer in the hot water in the cylinder.', acts: ['take thermometer', 'use cylinder'], view: 'thermometer', done: function () { return s().thermoAt === 'cylinder' || mixed(1); } },
      { text: 'Click Collect, and let it record the cold water for about 10 s.', logger: 'collect', done: function () { return runHasStart(1); } },
      { text: 'Read the thermometer and record it, then pour the hot water in at once.', acts: ['take cylinder', 'use cup'], view: 'thermometer', done: function () { return mixed(1); } },
      { text: 'Swirl the calorimeter, and keep swirling.', acts: ['swirl on'], done: function () { return s().swirling || runDone(1); } },
      { text: 'Let the run go to the end (or Stop it once the cooling line is long and straight).', logger: 'stop', done: function () { return runDone(1); } },
      { text: 'Fit a line to the cooling part of the graph and record T<sub>f</sub> at the mixing line.', done: function () { return results['p1-tf'] && results['p1-tf'].ok; } },
      { text: 'Empty the cup into the sink, then rinse and dry it.', acts: ['swirl off', 'take probe', 'use stand', 'empty sink', 'rinse'], done: function () { return mixed(1) && !s().dirty && !(s().cupMl > 0); } }
    ]
  };
  [2, 3].forEach(function (p) {
    var mg = p === 2, jar = mg ? 'mg' : 'mgo';
    STEPS[p] = [
      { text: 'Make sure the calorimeter is empty, clean and dry.', acts: ['swirl off', 'empty waste', 'rinse'], done: function () { var r = rec(p); return (r && r.acidMl > 0) || (!s().dirty && !s().cupWet && !(s().cupMl > 0)); } },
      { text: 'Measure 90.0&ndash;100. mL of 1.0 M HCl in the graduated cylinder.', acts: ['take acid', 'use cylinder'], done: function () { var r = rec(p); return s().cylKind === 'acid' || (r && r.acidMl > 0); } },
      { text: 'Read the cylinder and record the volume of HCl.', view: 'cylinder', done: function () { return results['p' + p + '-acidV'] && results['p' + p + '-acidV'].ok; } },
      { text: 'Pour the HCl into the calorimeter.', acts: ['take cylinder', 'use cup'], done: function () { var r = rec(p); return r && r.acidMl > 0; } },
      { text: 'Put the lid on and the probe through its hole.', acts: ['lid on', 'take probe', 'use cup'], done: function () { return (s().probeIn && s().lidOn) || mixed(p); } },
      { text: 'Put the weighing paper on the balance and press ZERO.', acts: ['take paper', 'use balance', 'tare'], view: 'balance', done: function () { return mixed(p) || (s().paperAt === 'balance' && Math.abs(s().tareG - 0.312) < 0.0005); } },
      { text: mg ? 'Add magnesium turnings, a few at a time, until you have about 0.20 g.' : 'Add magnesium oxide, a scoop at a time, until you have about 1.0 g.', acts: ['take ' + jar, 'use paper', 'putback'], again: true, view: 'balance',
        done: function () { return mixed(p) || (s().paperSolid === jar && s().paperSolidG >= (mg ? 0.17 : 0.85)); } },
      { text: 'Record the mass shown on the balance.', view: 'balance', done: function () { return results['p' + p + '-mass'] && results['p' + p + '-mass'].ok; } },
      { text: 'Set Data Collection to 600 s at 2 samples/s, click Collect, and let it record for about 10 s.', logger: 'collect', done: function () { return runHasStart(p); } },
      { text: 'Tip the ' + (mg ? 'magnesium' : 'magnesium oxide') + ' into the calorimeter.', acts: ['take paper', 'use cup'], view: 'cupTop', done: function () { return mixed(p); } },
      { text: 'Swirl the calorimeter, and keep swirling.', acts: ['swirl on'], done: function () { return s().swirling || runDone(p); } },
      { text: 'Let the run go to the end (or Stop it once the cooling line is long and straight).', logger: 'stop', done: function () { return runDone(p); } },
      { text: 'Fit a line to the cooling part of the graph and record T<sub>f</sub> at the mixing line.', done: function () { return results['p' + p + '-tf'] && results['p' + p + '-tf'].ok; } },
      { text: 'Empty the cup into the waste beaker, then rinse and dry it.', acts: ['swirl off', 'take probe', 'use stand', 'empty waste', 'rinse'], done: function () { return mixed(p) && !s().dirty && !(s().cupMl > 0); } }
    ];
  });

  function renderSteps() {
    var holder = $('steps');
    var list = STEPS[state.part];
    var next = -1;
    var html = '<h3>' + PART_NAMES[state.part] + ': steps</h3><ol class="step-list">';
    list.forEach(function (st, i) {
      var done = bench ? !!st.done() : false;   // nothing is done before the bench has reported
      if (!done && next < 0) next = i;
      var cls = done ? 'done' : (i === next ? 'next' : '');
      html += '<li class="' + cls + '"><span class="light" aria-hidden="true">' + (done ? '&#10003;' : String(i + 1)) + '</span><span class="step-text">' + st.text +
        (done ? '<span class="visually-hidden"> (done)</span>' : (i === next ? '<span class="visually-hidden"> (next)</span>' : '')) + '</span><span class="step-buttons">';
      if (st.acts) html += '<button type="button" class="quiet-button step-do" data-step="' + i + '">' + (st.again ? 'Add some' : 'Do it') + '</button>';
      if (st.view) html += '<button type="button" class="quiet-button step-look" data-view="' + st.view + '">Look</button>';
      if (st.logger === 'settings') html += '<button type="button" class="quiet-button step-logger" data-logger="settings">Settings</button>';
      if (st.logger === 'collect') html += '<button type="button" class="quiet-button step-logger" data-logger="collect">Collect</button>';
      if (st.logger === 'stop') html += '<button type="button" class="quiet-button step-logger" data-logger="stop">Stop</button>';
      html += '</span></li>';
    });
    html += '</ol>';
    holder.innerHTML = html;
  }

  function bindSteps() {
    $('steps').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('step-do')) act(STEPS[state.part][+b.getAttribute('data-step')].acts);
      else if (b.classList.contains('step-look')) sendBench('SetView', b.getAttribute('data-view'));
      else if (b.getAttribute('data-logger') === 'settings') openSettings();
      else if (b.getAttribute('data-logger') === 'collect') $('collect').click();
      else if (b.getAttribute('data-logger') === 'stop') $('stop').click();
    });
  }

  // ---- parts -------------------------------------------------------------------------------------------

  function setPart(p, tell) {
    state.part = p;
    Array.prototype.forEach.call(document.querySelectorAll('.part-tab'), function (b) { b.setAttribute('aria-selected', String(+b.getAttribute('data-part') === p)); });
    $('logger-part').textContent = PART_NAMES[p];
    if (tell) sendBench('Act', 'part ' + p);
    fitSel = state.fits[p] || null;
    renderSteps();
    drawGraph();
    saveState();
  }

  // ---- notes under the bench -------------------------------------------------------------------------

  var noteTimer = 0;
  function note(text, kind) {
    var n = $('stage-note');
    n.innerHTML = text || '';
    if (kind) n.setAttribute('data-kind', kind); else n.removeAttribute('data-kind');
    clearTimeout(noteTimer);
    if (text) noteTimer = setTimeout(function () { n.innerHTML = ''; n.removeAttribute('data-kind'); }, 9000);
  }

  var HELD_NAMES = { thermometer: 'the thermometer', water: 'the deionized water', acid: 'the 1.0 M HCl', cylinder: 'the graduated cylinder', beaker: 'the beaker of hot water', paper: 'the weighing paper', mg: 'the magnesium turnings', mgo: 'the magnesium oxide', probe: 'the temperature probe' };
  var HELD_HINTS = {
    thermometer: 'Click the beaker, the cylinder or the stand.', water: 'Click the graduated cylinder to pour.', acid: 'Click the graduated cylinder to pour.',
    cylinder: 'Click the calorimeter to pour it in.', beaker: 'Click the graduated cylinder to pour.', paper: 'Click the balance, the calorimeter, or the paper&rsquo;s spot.',
    mg: 'Click the weighing paper on the balance to add some. Click the jar again to put it down.', mgo: 'Click the weighing paper on the balance to add a scoop. Click the jar again to put it down.',
    probe: 'Click the calorimeter, or the probe&rsquo;s stand.'
  };

  var DONE_NOTES = {
    'use cylinder': 'Poured into the cylinder. Open the cylinder close-up to read it.',
    'heat on': 'The hot plate is heating the beaker.',
    'heat off': 'The hot plate is off.',
    'tare': 'The balance reads zero.',
    'rinse': 'The calorimeter is rinsed and dried.',
    'empty sink': 'Emptied into the sink.',
    'empty waste': 'Emptied into the waste beaker.'
  };

  // ---- from Unity ------------------------------------------------------------------------------------

  function onBenchEvent(json) {
    var e;
    try { e = typeof json === 'string' ? JSON.parse(json) : json; } catch (err) { return; }
    switch (e.type) {
      case 'ready':
        unityReady = true;
        configure();
        break;
      case 'state':
        bench = e.state;
        state.bench = bench;
        $('held-tag').hidden = !bench.held;
        if (bench.held) $('held-tag').innerHTML = 'In your hand: ' + (HELD_NAMES[bench.held] || bench.held);
        if (!collecting) $('live-temp').textContent = fmt(bench.probeC, 2);
        renderSteps();
        saveState();
        break;
      case 'done':
        if (e.step.indexOf('take ') === 0 && bench && bench.held) note(HELD_HINTS[e.step.substring(5)] || '');
        else if (DONE_NOTES[e.step]) note(DONE_NOTES[e.step]);
        else if (e.step === 'use cup' || e.step === 'swirl on') note(e.step === 'swirl on' ? 'Swirling. Keep the lid on.' : 'In the calorimeter.');
        setTimeout(function () { evaluate(); }, 50);
        break;
      case 'blocked':
        note(M.blockedText(e.reason), 'warn');
        break;
      case 'runStarted':
        if (state.runs[e.part] && state.runs[e.part].addedAt >= 0) { /* replaced: the earlier run is gone, as the student was warned */ }
        state.runs[e.part] = { id: e.run, part: e.part, length: e.length, rate: e.rate, t: [], c: [], addedAt: -1, ended: false };
        state.fits[e.part] = null; fitSel = null; fitResult = null;
        collecting = true;
        setLoggerButtons();
        drawGraph();
        break;
      case 'samples':
        var r = currentRun(e.run);
        if (!r) break;
        for (var i = 0; i < e.t.length; i++) { r.t.push(e.t[i]); r.c.push(e.c[i]); }
        $('live-temp').textContent = fmt(e.c[e.c.length - 1], 2);
        $('live-time').textContent = fmt(e.t[e.t.length - 1], 1);
        scheduleDraw();
        break;
      case 'added':
        var ra = state.runs[e.part];
        if (ra && !ra.ended) { ra.addedAt = e.t; note('Mixed at ' + fmt(e.t, 1) + ' s. Swirl and keep the lid on.'); }
        else note('That went in while the software was not collecting, so there is no graph of it. Start this part over and click Collect first.', 'warn');
        drawGraph();
        break;
      case 'runEnded':
        var re = currentRun(e.run);
        if (re) re.ended = true;
        collecting = false;
        setLoggerButtons();
        $('live-state').textContent = 'Not collecting';
        if (e.why === 'reload') note('The run stopped when the page was reloaded. What was recorded is kept.', 'warn');
        drawGraph();
        evaluate();
        break;
      case 'view':
        Array.prototype.forEach.call(document.querySelectorAll('.view-button'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-view') === e.view)); });
        break;
    }
  }

  function currentRun(id) {
    for (var p = 1; p <= 3; p++) if (state.runs[p] && state.runs[p].id === id && !state.runs[p].ended) return state.runs[p];
    return null;
  }

  function configure() {
    if (!unity || !unityReady) return;
    unity.SendMessage('Lab', 'Configure', JSON.stringify({ code: state.code, part: state.part, state: state.bench ? JSON.stringify(state.bench) : '', calm: reduceMotion }));
    configured = true;
    $('stage-cover').hidden = true;
    sendBench('SetSpeed', String(speed));
  }

  // ---- the logger -----------------------------------------------------------------------------------

  var speed = 1;
  function setLoggerButtons() {
    $('collect').disabled = collecting;
    $('stop').disabled = !collecting;
    $('live-state').textContent = collecting ? 'Collecting…' : 'Not collecting';
  }

  function openSettings() {
    var box = $('logger-settings');
    box.hidden = false;
    $('logger-settings-open').setAttribute('aria-expanded', 'true');
    $('set-length').focus();
  }

  function bindLogger() {
    $('set-length').value = state.settings.length;
    $('set-rate').value = state.settings.rate;
    function noteSettings() {
      var L = M.parseNumber(state.settings.length), R = M.parseNumber(state.settings.rate);
      $('set-note').textContent = (L && R ? R * L + ' readings, one every ' + fmt(1 / R, 2) + ' s. ' : '') + (settingsRight() ? '' : 'The handout asks for 600 s at 2 samples/s.');
      renderSteps();
    }
    ['set-length', 'set-rate'].forEach(function (id) {
      $(id).addEventListener('input', function () { state.settings[id === 'set-length' ? 'length' : 'rate'] = $(id).value; noteSettings(); saveState(); });
    });
    noteSettings();
    $('logger-settings-open').addEventListener('click', function () { if ($('logger-settings').hidden) openSettings(); else $('logger-settings-done').click(); });
    $('logger-settings-done').addEventListener('click', function () { $('logger-settings').hidden = true; $('logger-settings-open').setAttribute('aria-expanded', 'false'); });
    $('collect').addEventListener('click', function () {
      var L = M.parseNumber(state.settings.length), R = M.parseNumber(state.settings.rate);
      if (!(L >= 10 && L <= 3600) || !(R > 0 && R <= 10)) { note('Set a length (10 to 3600 s) and a sampling rate (up to 10 samples/s) under Data Collection first.', 'warn'); openSettings(); return; }
      var old = state.runs[state.part];
      if (old && old.addedAt >= 0 && !window.confirm('Collecting again replaces this part’s run and its graph. Go on?')) return;
      sendBench('Collect', JSON.stringify({ length: L, rate: R }));
    });
    $('stop').addEventListener('click', function () { sendBench('StopRun', ''); });
    Array.prototype.forEach.call(document.querySelectorAll('.speed-button'), function (b) {
      b.addEventListener('click', function () {
        speed = +b.getAttribute('data-speed');
        Array.prototype.forEach.call(document.querySelectorAll('.speed-button'), function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        sendBench('SetSpeed', String(speed));
      });
    });
    $('fit').addEventListener('click', doFit);
    $('clear-fit').addEventListener('click', function () { fitSel = null; fitResult = null; state.fits[state.part] = null; saveState(); drawGraph(); });
    bindGraphPointer();
  }

  // ---- the graph ------------------------------------------------------------------------------------

  var G = { left: 64, right: 18, top: 18, bottom: 46 };
  var fitSel = state.fits[state.part] || null;      // { t0, t1 } chosen by dragging
  var fitResult = null;
  var dragFrom = null, hoverX = null, drawQueued = false;

  function scheduleDraw() {
    if (drawQueued) return;
    drawQueued = true;
    window.requestAnimationFrame(function () { drawQueued = false; drawGraph(); });
  }

  function axes(r, w, h) {
    var tMax = r ? Math.max(r.length || 0, r.t.length ? r.t[r.t.length - 1] : 0) : (M.parseNumber(state.settings.length) || 180);
    var lo = 1e9, hi = -1e9;
    if (r) for (var i = 0; i < r.c.length; i++) { lo = Math.min(lo, r.c[i]); hi = Math.max(hi, r.c[i]); }
    if (fitResult && r && r.addedAt >= 0) { var y0 = fitResult.m * r.addedAt + fitResult.b; lo = Math.min(lo, y0); hi = Math.max(hi, y0); }
    if (lo > hi) { lo = 20; hi = 30; }
    var span = Math.max(hi - lo, 1);
    lo = Math.floor(lo - span * 0.08); hi = Math.ceil(hi + span * 0.08);
    return { tMax: tMax, lo: lo, hi: hi, x: function (t) { return G.left + t / tMax * (w - G.left - G.right); }, y: function (c) { return h - G.bottom - (c - lo) / (hi - lo) * (h - G.top - G.bottom); },
      t: function (px) { return (px - G.left) / (w - G.left - G.right) * tMax; } };
  }

  function niceStep(span, target) {
    var raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / p;
    return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
  }

  function drawGraph(canvas, forPrint, part) {
    canvas = canvas || $('graph');
    part = part || state.part;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var r = run(part);
    var sel = forPrint ? state.fits[part] : fitSel;
    var fr = sel && r ? M.fitRange(r, sel.t0, sel.t1) : null;
    if (!forPrint) fitResult = fr;
    var a = axes(r, w, h);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.font = '13px system-ui, sans-serif';
    // grid
    ctx.strokeStyle = '#e3e6ea'; ctx.lineWidth = 1; ctx.fillStyle = '#444';
    var ts = niceStep(a.tMax, 8), cs = niceStep(a.hi - a.lo, 6);
    ctx.textAlign = 'center';
    for (var t = 0; t <= a.tMax + 1e-6; t += ts) { var x = a.x(t); ctx.beginPath(); ctx.moveTo(x, G.top); ctx.lineTo(x, h - G.bottom); ctx.stroke(); ctx.fillText(String(Math.round(t)), x, h - G.bottom + 17); }
    ctx.textAlign = 'right';
    for (var c = Math.ceil(a.lo / cs) * cs; c <= a.hi + 1e-6; c += cs) { var y = a.y(c); ctx.beginPath(); ctx.moveTo(G.left, y); ctx.lineTo(w - G.right, y); ctx.stroke(); ctx.fillText(fmt(c, cs < 1 ? 1 : 0), G.left - 6, y + 4); }
    ctx.strokeStyle = '#555'; ctx.strokeRect(G.left, G.top, w - G.left - G.right, h - G.top - G.bottom);
    ctx.fillStyle = '#222'; ctx.textAlign = 'center';
    ctx.fillText('Time (s)', (G.left + w - G.right) / 2, h - 8);
    ctx.save(); ctx.translate(16, (G.top + h - G.bottom) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('Temperature (°C)', 0, 0); ctx.restore();
    if (!r) { ctx.fillStyle = '#666'; ctx.fillText('No run yet for ' + PART_NAMES[part] + '. Click Collect.', (G.left + w) / 2, (G.top + h - G.bottom) / 2); return; }
    // selection
    if (sel) {
      ctx.fillStyle = 'rgba(255, 196, 0, 0.18)';
      ctx.fillRect(a.x(sel.t0), G.top, a.x(sel.t1) - a.x(sel.t0), h - G.top - G.bottom);
    }
    // mixing line
    if (r.addedAt >= 0) {
      ctx.strokeStyle = '#7a3db8'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(a.x(r.addedAt), G.top); ctx.lineTo(a.x(r.addedAt), h - G.bottom); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#7a3db8'; ctx.textAlign = 'left'; ctx.fillText('mixed', a.x(r.addedAt) + 4, G.top + 14);
    }
    // data
    ctx.strokeStyle = '#1f5fbf'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (var i = 0; i < r.t.length; i++) { var px = a.x(r.t[i]), py = a.y(r.c[i]); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
    if (r.t.length < 400) { ctx.fillStyle = '#1f5fbf'; for (var j = 0; j < r.t.length; j++) { ctx.fillRect(a.x(r.t[j]) - 1.5, a.y(r.c[j]) - 1.5, 3, 3); } }
    // fit, carried back to the mixing line
    if (fr) {
      var from = r.addedAt >= 0 ? Math.min(r.addedAt, sel.t0) : sel.t0;
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x(sel.t0), a.y(fr.m * sel.t0 + fr.b)); ctx.lineTo(a.x(sel.t1), a.y(fr.m * sel.t1 + fr.b)); ctx.stroke();
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(a.x(from), a.y(fr.m * from + fr.b)); ctx.lineTo(a.x(sel.t0), a.y(fr.m * sel.t0 + fr.b)); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!forPrint) {
      $('fit').disabled = !sel;
      $('clear-fit').disabled = !sel;
      $('fit-text').innerHTML = fr ? 'Linear fit: T = ' + fr.m.toFixed(5) + ' t + ' + fr.b.toFixed(3) + ' (' + fr.n + ' points, ' + fmt(sel.t0, 1) + '&ndash;' + fmt(sel.t1, 1) + ' s)' : (sel ? '' : '');
    }
    if (forPrint && fr) { ctx.fillStyle = '#c0392b'; ctx.textAlign = 'left'; ctx.fillText('Fit: T = ' + fr.m.toFixed(5) + ' t + ' + fr.b.toFixed(3), G.left + 8, h - G.bottom - 10); }
    // examine
    if (!forPrint && $('examine').checked && hoverX != null) {
      var tt = Math.max(0, Math.min(a.tMax, a.t(hoverX)));
      var k = nearest(r, tt);
      if (k >= 0) {
        var ex = a.x(r.t[k]), ey = a.y(r.c[k]);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex, G.top); ctx.lineTo(ex, h - G.bottom); ctx.stroke();
        ctx.beginPath(); ctx.arc(ex, ey, 4, 0, 6.3); ctx.stroke();
        var tip = 't = ' + fmt(r.t[k], 1) + ' s,  T = ' + fmt(r.c[k], 2) + ' °C';
        if (fr) tip += '   (fit at t = ' + fmt(r.t[k], 1) + ' s: ' + fmt(fr.m * r.t[k] + fr.b, 2) + ' °C)';
        var tipEl = $('graph-tip'); tipEl.hidden = false; tipEl.textContent = tip;
      }
    } else if (!forPrint) $('graph-tip').hidden = true;
  }

  function nearest(r, t) {
    var best = -1, d = 1e9;
    for (var i = 0; i < r.t.length; i++) { var dd = Math.abs(r.t[i] - t); if (dd < d) { d = dd; best = i; } }
    return best;
  }

  function canvasX(e) {
    var c = $('graph'), rect = c.getBoundingClientRect();
    return (e.clientX - rect.left) * c.width / rect.width;
  }

  function bindGraphPointer() {
    var c = $('graph');
    c.addEventListener('pointerdown', function (e) {
      var r = run(state.part); if (!r || !r.t.length) return;
      dragFrom = canvasX(e);
      try { c.setPointerCapture(e.pointerId); } catch (err) { }
    });
    c.addEventListener('pointermove', function (e) {
      hoverX = canvasX(e);
      if (dragFrom != null) {
        var a = axes(run(state.part), c.width, c.height);
        var t0 = a.t(Math.min(dragFrom, hoverX)), t1 = a.t(Math.max(dragFrom, hoverX));
        t0 = Math.max(0, t0); t1 = Math.min(a.tMax, t1);
        if (t1 - t0 > 0.5) fitSel = { t0: t0, t1: t1 };
      }
      scheduleDraw();
    });
    function end() {
      if (dragFrom == null) return;
      dragFrom = null;
      if (fitSel) { state.fits[state.part] = fitSel; saveState(); }
      drawGraph();
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', function () { hoverX = null; scheduleDraw(); });
    $('examine').addEventListener('change', function () { drawGraph(); });
  }

  function doFit() {
    if (!fitSel) { note('Drag across the graph first to choose the readings to fit.', 'warn'); return; }
    state.fits[state.part] = fitSel;
    drawGraph();
    var r = run(state.part);
    if (fitResult && r && r.addedAt >= 0 && fitSel.t0 < r.addedAt + 30) note('Your region starts close to the mixing. Fit only the slow, straight cooling part, well after the peak.', 'warn');
    saveState();
  }

  /** For tests: choose a fit region by numbers. */
  function setFit(t0, t1) { fitSel = { t0: t0, t1: t1 }; doFit(); }

  // ---- report -------------------------------------------------------------------------------------------

  function updateReportStatus() {
    var total = 0, okCount = 0;
    Object.keys(results).forEach(function (k) { total++; if (results[k].ok === true) okCount++; });
    $('report-status').textContent = okCount + ' of ' + total + ' entries accepted so far.';
    var flags = 0; Object.keys(state.flags).forEach(function (k) { flags += state.flags[k]; });
    var notes = [];
    [1, 2, 3].forEach(function (p) {
      var r = run(p), rc = rec(p);
      if (r) notes.push(PART_NAMES[p] + ': run ' + fmt(r.t.length ? r.t[r.t.length - 1] : 0, 0) + ' s at ' + r.rate + '/s' + (r.addedAt >= 0 ? ', mixed at ' + fmt(r.addedAt, 1) + ' s' : ', never mixed during a run'));
      if (rc && (p === 1 ? rc.hotMl > 0 : rc.solidG > 0)) notes.push((rc.swirled ? 'swirled' : 'NOT swirled') + ', lid ' + (rc.lidOn ? 'on' : 'OFF') + ', probe ' + (rc.probeIn ? 'in' : 'OUT') + (p === 1 ? ', hot water read in the ' + rc.hotWhere : ''));
    });
    $('print-checks').textContent = 'Code ' + state.code + '. Wrong entries before acceptance: ' + flags + '. ' + notes.join('; ') + '.';
  }

  function bindReport() {
    var name = $('student-name');
    name.value = state.name;
    name.addEventListener('input', function () { state.name = name.value; $('print-name').textContent = name.value; saveState(); });
    $('print-report').addEventListener('click', function () { window.print(); });
    window.addEventListener('beforeprint', function () {
      $('print-name').textContent = state.name;
      $('print-date').textContent = new Date().toLocaleDateString();
      var holder = $('print-graphs');
      holder.innerHTML = '';
      [1, 2, 3].forEach(function (p) {
        if (!run(p)) return;
        var c = document.createElement('canvas'); c.width = 900; c.height = 380;
        drawGraph(c, true, p);
        var fig = el('figure', null, '<figcaption>' + PART_NAMES[p] + ': temperature against time</figcaption>');
        var img = el('img', { alt: PART_NAMES[p] + ' graph', src: c.toDataURL('image/png') });
        fig.insertBefore(img, fig.firstChild);
        holder.appendChild(fig);
      });
      updateReportStatus();
    });

    function confirmPair(open, box, no, yes, onYes) {
      $(open).addEventListener('click', function () { $(open).hidden = true; $(box).hidden = false; $(no).focus(); });
      $(no).addEventListener('click', function () { $(box).hidden = true; $(open).hidden = false; });
      $(yes).addEventListener('click', function () { $(box).hidden = true; $(open).hidden = false; onYes(); });
    }
    confirmPair('new-unknown', 'new-confirm', 'new-no', 'new-yes', function () {
      state = blankState(); bench = null;
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { }
      window.location.search = '';
    });
    confirmPair('start-part-over', 'part-confirm', 'part-no', 'part-yes', function () {
      var p = state.part;
      TABLES[p - 1].data.concat(TABLES[p - 1].calcs).forEach(function (f) { delete state.entries[f.id]; var i = $(f.id); if (i) i.value = ''; });
      state.runs[p] = null; state.fits[p] = null; fitSel = null;
      if (bench) {
        var blank = { coldMl: -1, coldC: -99, hotMl: -1, hotC: -99, hotShown: -99, hotWhere: '', acidMl: -1, solidG: -1, solidShown: -99, solidTared: false, addedAt: -1, swirled: false, lidOn: false, probeIn: false };
        bench['r' + p] = blank;
        bench.cupMl = 0; bench.cupKind = ''; bench.acidMol = 0; bench.mgMol = 0; bench.mgoMol = 0; bench.dirty = false; bench.cupWet = false;
        bench.swirling = false; bench.collecting = false; bench.probeIn = false; bench.cylMl = 0; bench.cylKind = '';
        bench.paperAt = 'home'; bench.paperSolid = ''; bench.paperSolidG = 0; bench.scoops = []; bench.tareG = 0; bench.held = '';
        if (p === 1) { bench.beakerMl = 150; bench.heating = false; }
        state.bench = bench;
      }
      saveState();
      configured = false; configure();
      drawGraph(); evaluate();
    });
  }

  // ---- views, parts, wiring ----------------------------------------------------------------------------

  function bindBench() {
    Array.prototype.forEach.call(document.querySelectorAll('.view-button'), function (b) {
      b.addEventListener('click', function () { sendBench('SetView', b.getAttribute('data-view')); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.part-tab'), function (b) {
      b.addEventListener('click', function () {
        if (collecting) { note('Stop the run before you change parts.', 'warn'); return; }
        setPart(+b.getAttribute('data-part'), true);
      });
    });
    window.addEventListener('wheel', function (e) { if (e.target === $('unity-canvas')) e.stopImmediatePropagation(); }, { capture: true, passive: true });
  }

  var lab = window.CalLab = {
    isMock: !!standIn,
    onUnityEvent: onBenchEvent,
    attachUnity: function (instance) { unity = instance; configure(); },
    unityProgress: function (f) { $('progress-fill').style.width = Math.round(Math.max(0.04, f) * 100) + '%'; },
    unityFailed: function (error) {
      console.error(error);
      var cover = $('stage-cover');
      cover.hidden = false; cover.setAttribute('data-state', 'failed');
      $('stage-status').textContent = 'The 3D lab could not start in this browser. Open this page in a current version of Chrome, Edge, Firefox or Safari on a computer.';
      document.querySelector('.progress').hidden = true;
    },
    unityBanner: function (message, type) { if (type === 'error') lab.unityFailed(message); else console.warn(message); },
    // for tests
    state: function () { return state; },
    bench: function () { return bench; },
    results: function () { return results; },
    setFit: setFit,
    act: act,
    setEntry: function (id, v) { state.entries[id] = v; var i = $(id); if (i) i.value = v; evaluate(id); }
  };

  $('unknown-code').textContent = state.code;
  buildTables();
  bindSteps();
  bindLogger();
  bindBench();
  bindReport();
  setPart(state.part || 1, false);
  evaluate();

  if (standIn) { unity = standIn(onBenchEvent); onBenchEvent('{"type":"ready"}'); }
})();
