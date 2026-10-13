/*
 * The Atomic Spectrum of Hydrogen: page logic.
 * Keeps what the student records, checks what follows from the equations printed on the page, and
 * talks to the 3D lab (a Unity build in the canvas: a fume hood with a tray of gas tubes, a power
 * supply, a white lamp, a prism and screen, a spectroscope and a detector inside it).
 *
 * The page does not know what is in the unknown tube, and it holds no list of any gas's lines. The
 * 3D lab works those out. It tells the page what is switched on, it answers a request for a sweep
 * of the detector with a row of readings, and it judges each wavelength a student measured against
 * the tube it was measured on. Which gas the unknown is, is never checked: the instructor marks
 * that from the answer key.
 */
(function () {
  'use strict';

  var M = window.SpectrumLabModel;
  var STORE_KEY = 'hydrogen-spectrum-lab:v1';
  var params = new URLSearchParams(window.location.search);
  // Automated tests of the page run it without the 3D lab, against a stand-in they supply.
  var standIn = typeof window.SpectrumLabStandIn === 'function' ? window.SpectrumLabStandIn : null;
  var GIVEN_TEXT = '-0.242';     // the energy of level 3, shown as the example

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }
  function times(n, fn) { var out = []; for (var i = 0; i < n; i++) out.push(fn(i)); return out; }
  function filled(text) { return !!String(text == null ? '' : text).trim(); }

  // ---- Saved work ----------------------------------------------------------------------------

  function blankState(code) {
    var levels = {}, jumps = {}, limit = {};
    for (var n = 1; n <= M.LEVELS; n++) levels[n] = n === M.GIVEN_LEVEL ? GIVEN_TEXT : '';
    M.JUMPS.forEach(function (j) { jumps[j.key] = { e: '', w: '' }; });
    M.LIMIT_LEVELS.forEach(function (n) { limit[n] = { e: '', w: '' }; });
    return {
      v: 1,
      code: code || M.randomCode(),
      name: '',
      bench: null,                  // the bench as the 3D lab last reported it
      lines: times(M.HYDROGEN_LINES, function () { return ''; }),
      looks: { lamp: '', tube: '', count: '' },
      unknown: {
        glow: '', lines: times(M.UNKNOWN_LINES, function () { return ''; }),
        match: '', matchGlow: '', matchLines: times(M.UNKNOWN_LINES, function () { return ''; }), why: ''
      },
      levels: levels,
      jumps: jumps,
      match: times(M.HYDROGEN_LINES, function () { return { hi: '', lo: '' }; }),
      common: { end: '', level: '' },
      longest: '',
      limit: limit,
      trend: '', limitValue: '', trendWhy: '',
      flags: { lines: 0, unknown: 0, levels: 0, jumps: 0, match: 0, questions: 0 }
    };
  }

  // Lays saved work over a fresh sheet, keeping only what has the right shape.
  function overlay(fresh, saved) {
    if (saved === null || typeof saved !== 'object') return fresh;
    Object.keys(fresh).forEach(function (k) {
      var a = fresh[k], b = saved[k];
      if (Array.isArray(a)) {
        if (Array.isArray(b)) for (var i = 0; i < a.length; i++) if (b[i] !== undefined) a[i] = typeof a[i] === 'object' ? overlay(a[i], b[i]) : (typeof b[i] === typeof a[i] ? b[i] : a[i]);
      } else if (a !== null && typeof a === 'object') {
        fresh[k] = overlay(a, b);
      } else if (typeof b === typeof a) {
        fresh[k] = b;
      }
    });
    return fresh;
  }

  function loadState() {
    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE_KEY));
      if (!saved || saved.v !== 1 || !M.isCode(saved.code)) return null;
      var state = overlay(blankState(saved.code), saved);
      state.bench = saved.bench && typeof saved.bench === 'object' && typeof saved.bench.holder === 'number' ? saved.bench : null;
      state.levels[M.GIVEN_LEVEL] = GIVEN_TEXT;
      return state;
    } catch (e) {
      return null;
    }
  }

  function saveState() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private window: work simply is not kept */ }
  }

  var state = loadState();
  // An instructor can hand out a link that ends in ?code=..., so that a student gets that unknown.
  var requested = M.normalizeCode(params.get('code') || '');
  if (requested && M.isCode(requested) && (!state || state.code !== requested)) state = blankState(requested);
  if (!state) state = blankState();

  // ---- Entries, their verdicts and their messages ------------------------------------------------
  // Every box that is checked is registered here under a name, in a group that shares one line of
  // message under its table. The message shown is for the box being worked on, or else for the
  // first one in the group that needs attention.

  var fields = {};           // name -> { group, label, node, result }
  var fieldOrder = [];
  var focusOf = {};          // group -> the name of the box last worked on
  var lastFlagged = {};      // name -> last value that was flagged, so the same slip is not counted twice
  var GROUP_MSG = { lines: 'line-msg', looks: 'look-msg', unknown: 'unknown-msg', levels: 'level-msg', jumps: 'jump-msg', match: 'match-msg', limit: 'msg-limit' };

  function register(name, group, label, node, focusNodes) {
    if (!fields[name]) fieldOrder.push(name);
    fields[name] = { group: group, label: label, node: node, result: { ok: null, message: '' } };
    (focusNodes || [node]).forEach(function (n) {
      n.addEventListener('focus', function () { focusOf[group] = name; showGroup(group); });
    });
  }

  function setState(node, result) {
    var name = result.ok === true ? 'ok' : (result.ok === false ? 'bad' : '');
    if (name) node.setAttribute('data-state', name); else node.removeAttribute('data-state');
  }

  function showMessage(msg, result, label) {
    if (!msg) return;
    msg.textContent = result.message ? (label ? label + ': ' : '') + result.message : '';
    if (result.ok !== false) msg.setAttribute('data-kind', 'tip'); else msg.removeAttribute('data-kind');
  }

  function setResult(name, result) {
    var f = fields[name];
    if (!f) return;
    f.result = result;
    setState(f.node, result);
  }

  function resultOf(name) { return fields[name] ? fields[name].result : { ok: null, message: '' }; }
  function accepted(name) { return resultOf(name).ok === true; }

  function showGroup(group) {
    var msg = $(GROUP_MSG[group]);
    if (!msg) return;
    var name = focusOf[group];
    if (!name || !fields[name] || !fields[name].result.message) {
      name = fieldOrder.filter(function (n) { return fields[n].group === group && fields[n].result.ok === false; })[0] || '';
    }
    if (name) showMessage(msg, fields[name].result, fields[name].label);
    else showMessage(msg, { ok: null, message: '' });
  }

  function countFlag(flagGroup, name, value, result) {
    if (result.ok !== false) return;
    if (lastFlagged[name] === value) return;
    lastFlagged[name] = value;
    state.flags[flagGroup] += 1;
  }

  function syncPrintCopy(textarea) {
    var copy = textarea.nextSibling;
    if (copy && copy.className === 'print-copy') copy.textContent = textarea.value;
  }
  function withPrintCopy(textarea) {
    textarea.parentNode.insertBefore(el('div', { 'class': 'print-copy' }), textarea.nextSibling);
  }

  // ---- Entries judged by the 3D lab ------------------------------------------------------------------
  // A measured wavelength goes to the 3D lab, which answers with a verdict. A verdict belongs to
  // the exact text it was given for: change the entry and it is unjudged again.

  var remote = {};        // name -> { kind, a, flag, text(), pre(text), message(verdict) }
  var verdicts = {};      // name -> { context, verdict }
  var asked = {};         // request number -> { name: context }
  var nextAsk = 1;
  var toCount = {};       // entries the student just changed: count a flag once their verdict is in

  function contextOf(name) { return remote[name].text() + '|' + state.code; }

  function remoteResult(name) {
    var r = remote[name], text = r.text();
    if (!filled(text)) return { ok: null, message: '' };
    var pre = r.pre ? r.pre(text) : null;
    if (pre) return pre;
    var known = verdicts[name];
    if (!known || known.context !== contextOf(name)) return { ok: null, message: '', waiting: true };
    return r.message(known.verdict);
  }

  // names: which entries to send (those already judged as they stand are left out).
  function ask(names, byStudent) {
    var id = nextAsk++, sent = {}, items = [];
    names.forEach(function (name) {
      var r = remote[name], text = r.text();
      if (byStudent) toCount[name] = true;
      if (!filled(text) || (r.pre && r.pre(text))) return;
      var known = verdicts[name];
      if (known && known.context === contextOf(name)) return;
      var item = { field: name, kind: r.kind, a: r.a };
      if (r.kind === 'look') item.text = text; else item.value = M.parseNumber(text);
      items.push(item);
      sent[name] = contextOf(name);
    });
    if (items.length && benchReady) {
      asked[id] = sent;
      sendBench('Check', JSON.stringify({ id: id, items: items }));
    }
    showRemote();
  }

  function takeVerdicts(e) {
    var sent = asked[e.id];
    delete asked[e.id];
    if (!sent || e.code !== state.code) return;
    (e.rows || []).forEach(function (row) {
      if (row.verdict && sent[row.field] !== undefined) verdicts[row.field] = { context: sent[row.field], verdict: row.verdict };
    });
    showRemote();
  }

  function lineName(i) { return 'line-' + i; }

  function showRemote() {
    var earlier = [];       // accepted hydrogen lines in the boxes before this one
    Object.keys(remote).forEach(function (name) {
      var result = remoteResult(name);
      if (name.indexOf('line-') === 0 && result.ok === true) {
        var nm = M.parseNumber(remote[name].text());
        var twin = earlier.filter(function (o) { return M.sameLine(o.nm, nm); })[0];
        if (twin) result = { ok: false, message: 'You already have this line, in box ' + (twin.i + 1) + '.' };
        else earlier.push({ i: +name.slice(5), nm: nm });
      }
      setResult(name, result);
      if (toCount[name] && !result.waiting) {
        delete toCount[name];
        countFlag(remote[name].flag, name, remote[name].text(), result);
      }
    });
    ['lines', 'looks', 'unknown'].forEach(showGroup);
    var found = acceptedLines().length;
    $('line-status').textContent = found === M.HYDROGEN_LINES ? 'All fifteen lines are found.' : (found > 0 ? found + ' of 15 lines found.' : '');
    checkMatchLines();
    buildMatchRows(false);
    checkLongest();
    saveState();
    updateReportStatus();
    updateNote();
  }

  // The hydrogen lines that have been measured and accepted, shortest wavelength first.
  function acceptedLines() {
    var out = [];
    for (var i = 0; i < M.HYDROGEN_LINES; i++) {
      if (accepted(lineName(i))) out.push({ i: i, nm: M.parseNumber(state.lines[i]), text: state.lines[i].trim() });
    }
    return out.sort(function (a, b) { return a.nm - b.nm; });
  }

  // ---- Part 1: what the light looks like, and Table 1 ---------------------------------------------

  function fillSelect(select, options, value) {
    select.textContent = '';
    select.appendChild(el('option', { value: '' }, '–'));
    options.forEach(function (o) { select.appendChild(el('option', { value: o.value }, o.text)); });
    select.value = value;
  }

  function bindLooks() {
    [['lamp', -1, 'The white lamp'], ['tube', M.HYDROGEN, 'Hydrogen']].forEach(function (spec) {
      var key = spec[0], select = $('look-' + key), name = 'look-' + key;
      fillSelect(select, M.LOOKS, state.looks[key]);
      register(name, 'looks', spec[2], select);
      remote[name] = { kind: 'look', a: spec[1], flag: 'lines', text: function () { return state.looks[key]; }, message: M.lookMessage };
      select.addEventListener('change', function () { state.looks[key] = select.value; focusOf.looks = name; saveState(); ask([name], true); });
    });
    var count = $('look-count');
    count.value = state.looks.count;
    register('look-count', 'looks', 'Lines seen', count);
    remote['look-count'] = {
      kind: 'count', a: M.HYDROGEN, flag: 'lines',
      text: function () { return state.looks.count; },
      pre: function (text) { var v = M.parseNumber(text); return v === null || v !== Math.round(v) || v < 0 ? { ok: false, message: 'Type a whole number.' } : null; },
      message: M.countMessage
    };
    bindEntry(count, function (v) { state.looks.count = v; }, function () { ask(['look-count'], true); });
  }

  // An entry box: keeps what is typed, and has it checked when the student moves on or presses Enter.
  function bindEntry(input, keep, check) {
    input.addEventListener('input', function () {
      keep(input.value);
      input.removeAttribute('data-state');
      saveState();
    });
    input.addEventListener('change', check);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  }

  function buildLineGrid() {
    var grid = $('line-grid');
    grid.textContent = '';
    for (var i = 0; i < M.HYDROGEN_LINES; i++) (function (i) {
      var name = lineName(i);
      var item = el('li', { 'class': 'line-cell' });
      var label = el('label');
      label.appendChild(el('span', { 'class': 'line-number' }, String(i + 1)));
      var input = el('input', { type: 'text', id: name, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Line ' + (i + 1) + ', wavelength in nanometers' });
      input.value = state.lines[i];
      label.appendChild(input);
      item.appendChild(label);
      grid.appendChild(item);
      register(name, 'lines', 'Box ' + (i + 1), input);
      remote[name] = {
        kind: 'line', a: M.HYDROGEN, flag: 'lines',
        text: function () { return state.lines[i]; },
        pre: M.checkMeasured,
        message: function (v) { return M.lineMessage(v, M.HYDROGEN); }
      };
      bindEntry(input, function (v) { state.lines[i] = v; }, function () { focusOf.lines = name; ask([name], true); });
    })(i);
  }

  // ---- Part 2: the unknown tube -----------------------------------------------------------------------

  function buildUnknownRows() {
    var body = $('unknown-rows');
    body.textContent = '';
    var match = $('match');
    fillSelect(match, M.REFERENCES.map(function (slot) { return { value: M.TUBES[slot].key, text: M.TUBES[slot].name }; }), state.unknown.match);
    match.onchange = function () { state.unknown.match = match.value; saveState(); updateReportStatus(); };

    var tr = el('tr');
    tr.appendChild(el('th', { scope: 'row' }, 'Color of the glow'));
    [['glow', 'Color of the unknown tube’s glow'], ['matchGlow', 'Color of the matching tube’s glow']].forEach(function (spec) {
      var td = el('td'), select = el('select', { id: 'unknown-' + spec[0], 'aria-label': spec[1] });
      fillSelect(select, M.GLOWS, state.unknown[spec[0]]);
      select.addEventListener('change', function () { state.unknown[spec[0]] = select.value; saveState(); updateReportStatus(); });
      td.appendChild(select);
      tr.appendChild(td);
    });
    body.appendChild(tr);

    for (var i = 0; i < M.UNKNOWN_LINES; i++) (function (i) {
      var row = el('tr');
      row.appendChild(el('th', { scope: 'row' }, 'Bright line ' + (i + 1) + ' (nm)'));

      var uName = 'uline-' + i, mName = 'mline-' + i;
      var uCell = el('td'), uInput = el('input', { type: 'text', id: uName, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Unknown tube, bright line ' + (i + 1) + ', in nanometers' });
      uInput.value = state.unknown.lines[i];
      uCell.appendChild(uInput);
      row.appendChild(uCell);
      register(uName, 'unknown', 'Unknown, line ' + (i + 1), uInput);
      remote[uName] = {
        kind: 'line', a: M.UNKNOWN, flag: 'unknown',
        text: function () { return state.unknown.lines[i]; },
        pre: function (text) {
          var early = M.checkMeasured(text);
          if (early) return early;
          var v = M.parseNumber(text);
          for (var k = 0; k < i; k++) {
            var other = M.parseNumber(state.unknown.lines[k]);
            if (other !== null && M.sameLine(other, v)) return { ok: false, message: 'That is the same line as line ' + (k + 1) + '. Choose four different lines.' };
          }
          return null;
        },
        message: function (v) { return M.lineMessage(v, M.UNKNOWN); }
      };
      bindEntry(uInput, function (v) { state.unknown.lines[i] = v; }, function () { focusOf.unknown = uName; ask([uName], true); });

      var mCell = el('td'), mInput = el('input', { type: 'text', id: mName, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Matching tube, the same line ' + (i + 1) + ', in nanometers' });
      mInput.value = state.unknown.matchLines[i];
      mCell.appendChild(mInput);
      row.appendChild(mCell);
      register(mName, 'unknown', 'Matching tube, line ' + (i + 1), mInput);
      bindEntry(mInput, function (v) { state.unknown.matchLines[i] = v; }, function () { focusOf.unknown = mName; checkMatchLines(mName); });
      body.appendChild(row);
    })(i);
  }

  // The same four lines in the tube said to match: each must stand where the unknown's does. That
  // is checked against the student's own measurement beside it, never against any gas.
  function checkMatchLines(changed) {
    for (var i = 0; i < M.UNKNOWN_LINES; i++) {
      var name = 'mline-' + i;
      if (!fields[name]) continue;
      var own = accepted('uline-' + i) ? M.parseNumber(state.unknown.lines[i]) : null;
      var text = state.unknown.matchLines[i];
      var result = M.checkAgrees(text, own);
      setResult(name, result);
      if (changed === name) countFlag('unknown', name, text, result);
    }
    showGroup('unknown');
    if (changed) { saveState(); updateReportStatus(); }
  }

  function unknownLinesAccepted() {
    var n = 0;
    for (var i = 0; i < M.UNKNOWN_LINES; i++) if (accepted('uline-' + i)) n++;
    return n;
  }
  function matchLinesAccepted() {
    var n = 0;
    for (var i = 0; i < M.UNKNOWN_LINES; i++) if (accepted('mline-' + i)) n++;
    return n;
  }

  // ---- Part 3: Table 3 and the graph ----------------------------------------------------------------------

  var UNIT = '× 10⁻¹⁸ J';

  function energyCell(n) {
    var td = el('td', { 'class': 'energy-cell' });
    var name = 'level-' + n;
    var input = el('input', { type: 'text', id: name, inputmode: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Energy of level ' + n + ', the number in front of ten to the minus eighteen joules' });
    input.value = state.levels[n];
    if (n === M.GIVEN_LEVEL) { input.readOnly = true; input.className = 'given'; }
    td.appendChild(input);
    td.appendChild(el('span', { 'class': 'unit' }, UNIT));
    register(name, 'levels', 'n = ' + n, input);
    if (n !== M.GIVEN_LEVEL) bindEntry(input, function (v) { state.levels[n] = v; }, function () { focusOf.levels = name; checkLevels(name); });
    return td;
  }

  function buildLevelRows() {
    var body = $('level-rows');
    body.textContent = '';
    for (var r = 1; r <= 5; r++) {
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row' }, String(r)));
      tr.appendChild(energyCell(r));
      tr.appendChild(el('th', { scope: 'row' }, String(r + 5)));
      tr.appendChild(energyCell(r + 5));
      body.appendChild(tr);
    }
  }

  function checkLevels(changed) {
    for (var n = 1; n <= M.LEVELS; n++) {
      var name = 'level-' + n;
      var result = n === M.GIVEN_LEVEL ? { ok: null, message: '' } : M.checkEnergy(n, state.levels[n]);
      setResult(name, result);
      if (changed === name) countFlag('levels', name, state.levels[n], result);
    }
    showGroup('levels');
    drawGraph();
    checkJumps();      // an energy change may follow from the student's own energies
    saveState();
    updateReportStatus();
  }

  // The energy a student has for a level, once it is accepted (the example always is).
  function ownEnergy(n) {
    if (n === M.GIVEN_LEVEL) return M.parseNumber(GIVEN_TEXT);
    return accepted('level-' + n) ? M.parseNumber(state.levels[n]) : null;
  }
  function levelsAccepted() {
    var k = 0;
    for (var n = 1; n <= M.LEVELS; n++) if (n !== M.GIVEN_LEVEL && accepted('level-' + n)) k++;
    return k;
  }

  // The graph of Part II of the handout, drawn from the student's own accepted energies.
  function drawGraph() {
    var svg = $('graph-svg'), NS = 'http://www.w3.org/2000/svg';
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W = 520, H = 360, left = 70, right = 18, top = 16, bottom = 52;
    var yMin = -2.4, yMax = 0;
    function x(n) { return left + (n - 0.5) * (W - left - right) / 10; }
    function y(e) { return top + (yMax - e) * (H - top - bottom) / (yMax - yMin); }
    function add(tag, attrs, text) {
      var node = document.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
      if (text != null) node.textContent = text;
      svg.appendChild(node);
      return node;
    }
    for (var e = 0; e >= yMin - 1e-9; e -= 0.4) {
      add('line', { x1: left, x2: W - right, y1: y(e), y2: y(e), 'class': e === 0 ? 'graph-zero' : 'graph-grid' });
      add('text', { x: left - 8, y: y(e) + 4, 'text-anchor': 'end', 'class': 'graph-tick' }, e === 0 ? '0' : e.toFixed(1).replace('-', '−'));
    }
    add('line', { x1: left, x2: left, y1: top, y2: H - bottom, 'class': 'graph-axis' });
    add('line', { x1: left, x2: W - right, y1: H - bottom, y2: H - bottom, 'class': 'graph-axis' });
    for (var n = 1; n <= M.LEVELS; n++) {
      add('line', { x1: x(n), x2: x(n), y1: H - bottom, y2: H - bottom + 5, 'class': 'graph-axis' });
      add('text', { x: x(n), y: H - bottom + 19, 'text-anchor': 'middle', 'class': 'graph-tick' }, String(n));
    }
    add('text', { x: (left + W - right) / 2, y: H - 10, 'text-anchor': 'middle', 'class': 'graph-label' }, 'Principal quantum number, n');
    add('text', { x: 16, y: (top + H - bottom) / 2, 'text-anchor': 'middle', 'class': 'graph-label', transform: 'rotate(-90 16 ' + (top + H - bottom) / 2 + ')' }, 'Energy (× 10⁻¹⁸ J)');
    var shown = 0;
    for (var k = 1; k <= M.LEVELS; k++) {
      var own = ownEnergy(k);
      if (own === null) continue;
      shown++;
      add('circle', { cx: x(k), cy: y(Math.max(yMin, Math.min(yMax, own))), r: 4.5, 'class': 'graph-point' });
    }
    $('graph-caption').textContent = shown >= M.LEVELS ? 'Your ten energy levels. Keep this graph in mind for the last question.' :
      'Your energy levels. Each value appears here as you enter it in Table 3 (' + shown + ' of 10 so far).';
  }

  // ---- Part 4: Table 4 -----------------------------------------------------------------------------------

  function jumpCell(hi, lo, kind) {
    var td = el('td');
    if (hi <= lo) { td.className = 'no-jump'; return td; }
    var key = hi + '-' + lo, name = (kind === 'e' ? 'de-' : 'wl-') + key;
    var input = el('input', { type: 'text', id: name, inputmode: kind === 'e' ? 'text' : 'decimal', autocomplete: 'off', spellcheck: 'false',
      'aria-label': (kind === 'e' ? 'Energy change' : 'Wavelength in nanometers') + ' for the fall from level ' + hi + ' to level ' + lo });
    input.value = state.jumps[key][kind];
    td.appendChild(input);
    register(name, 'jumps', hi + ' → ' + lo + (kind === 'e' ? ', energy' : ', wavelength'), input);
    bindEntry(input, function (v) { state.jumps[key][kind] = v; }, function () { focusOf.jumps = name; checkJumps(name); });
    return td;
  }

  function buildJumpRows() {
    var body = $('jump-rows');
    body.textContent = '';
    for (var lo = 1; lo <= 5; lo++) {
      ['e', 'w'].forEach(function (kind) {
        var tr = el('tr', { 'class': kind === 'e' ? 'energy-row' : 'wave-row' });
        if (kind === 'e') tr.appendChild(el('th', { scope: 'rowgroup', rowspan: '2', 'class': 'lower' }, String(lo)));
        var what = el('th', { scope: 'row', 'class': 'what' });
        if (kind === 'e') { what.appendChild(document.createTextNode('ΔE (')); what.appendChild(document.createTextNode(UNIT + ')')); }
        else what.textContent = 'Wavelength (nm)';
        tr.appendChild(what);
        for (var hi = 6; hi >= 2; hi--) tr.appendChild(jumpCell(hi, lo, kind));
        body.appendChild(tr);
      });
    }
  }

  function checkJumps(changed) {
    M.JUMPS.forEach(function (j) {
      var eName = 'de-' + j.key, wName = 'wl-' + j.key, entry = state.jumps[j.key];
      var lower = ownEnergy(j.lo), upper = ownEnergy(j.hi);
      var own = lower !== null && upper !== null ? lower - upper : null;
      var eResult = M.checkDelta(j.hi, j.lo, entry.e, own);
      setResult(eName, eResult);
      if (changed === eName) countFlag('jumps', eName, entry.e, eResult);
      var wResult = M.checkWavelength(j.hi, j.lo, entry.w, eResult.ok === true ? M.parseNumber(entry.e) : null);
      setResult(wName, wResult);
      if (changed === wName) countFlag('jumps', wName, entry.w, wResult);
    });
    showGroup('jumps');
    if (changed) { saveState(); updateReportStatus(); }
  }
  function jumpsAccepted() {
    var k = 0;
    M.JUMPS.forEach(function (j) { if (accepted('de-' + j.key)) k++; if (accepted('wl-' + j.key)) k++; });
    return k;
  }

  // ---- Part 5: Table 5 --------------------------------------------------------------------------------------
  // One row for each line measured in Table 1, shortest wavelength first. A row belongs to its box
  // in Table 1, so a jump already given stays with its line if the list is put in a new order.

  var matchSignature = null;

  function buildMatchRows(force) {
    var lines = acceptedLines();
    var signature = lines.map(function (l) { return l.i + ':' + l.text; }).join(',');
    if (!force && signature === matchSignature) return;
    matchSignature = signature;
    // the rows are made afresh, so the old ones are forgotten
    fieldOrder = fieldOrder.filter(function (name) {
      if (fields[name].group !== 'match') return true;
      delete fields[name];
      return false;
    });
    var body = $('match-rows');
    body.textContent = '';
    var toGo = M.HYDROGEN_LINES - lines.length;
    $('match-status').textContent = !lines.length || !toGo ? '' : toGo + (toGo === 1 ? ' line is' : ' lines are') + ' still to be measured in Table 1.';
    if (!lines.length) {
      var empty = el('tr');
      empty.appendChild(el('td', { 'class': 'not-yet', colspan: '4' }, 'The lines you measure in Table 1 will appear here.'));
      body.appendChild(empty);
    }
    // two lines to a row: down the left half of the table, then down the right
    var half = Math.ceil(lines.length / 2);
    for (var r = 0; r < half; r++) {
      var tr = el('tr');
      [r, r + half].forEach(function (at) {
        var line = lines[at];
        if (!line) { tr.appendChild(el('td', { 'class': 'no-jump' })); tr.appendChild(el('td', { 'class': 'no-jump' })); return; }
        tr.appendChild(el('td', { 'class': 'measured' }, line.text));
        tr.appendChild(matchCell(line));
      });
      body.appendChild(tr);
    }
    checkMatch();
  }

  function matchCell(line) {
    var i = line.i, name = 'jump-' + i, entry = state.match[i];
    var td = el('td', { 'class': 'jump-entry', id: name });
    var hi = el('input', { type: 'text', id: 'hi-' + i, inputmode: 'numeric', autocomplete: 'off', maxlength: '3', 'aria-label': 'Higher level for the line at ' + line.text + ' nanometers' });
    var lo = el('input', { type: 'text', id: 'lo-' + i, inputmode: 'numeric', autocomplete: 'off', maxlength: '3', 'aria-label': 'Lower level for the line at ' + line.text + ' nanometers' });
    hi.value = entry.hi;
    lo.value = entry.lo;
    td.appendChild(hi);
    td.appendChild(el('span', { 'class': 'arrow', 'aria-hidden': 'true' }, '→'));
    td.appendChild(lo);
    register(name, 'match', line.text + ' nm', td, [hi, lo]);
    [[hi, 'hi'], [lo, 'lo']].forEach(function (pair) {
      bindEntry(pair[0], function (v) { entry[pair[1]] = v; td.removeAttribute('data-state'); }, function () { focusOf.match = name; checkMatch(name); });
    });
    return td;
  }

  function checkMatch(changed) {
    acceptedLines().forEach(function (line) {
      var name = 'jump-' + line.i, entry = state.match[line.i];
      if (!fields[name]) return;
      var result = M.checkJump(line.nm, entry.hi, entry.lo);
      setResult(name, result);
      if (changed === name) countFlag('match', name, entry.hi + '>' + entry.lo, result);
    });
    showGroup('match');
    if (changed) { saveState(); updateReportStatus(); }
  }
  function matchAccepted() {
    return acceptedLines().filter(function (line) { return M.checkJump(line.nm, state.match[line.i].hi, state.match[line.i].lo).ok === true; }).length;
  }

  // ---- Part 6: the questions ---------------------------------------------------------------------------------

  var single = {};        // results of the questions that stand alone

  function checkCommon(byStudent) {
    var result = M.checkCommon(state.common.end, state.common.level);
    single.common = result;
    setState($('common-end'), result);
    setState($('common-level'), result);
    showMessage($('msg-common'), result);
    if (byStudent) countFlag('questions', 'common', state.common.end + state.common.level, result);
    saveState();
    updateReportStatus();
  }

  function checkLongest(byStudent) {
    var result = M.checkLongest(state.longest, acceptedLines().map(function (l) { return l.nm; }));
    single.longest = result;
    setState($('longest'), result);
    showMessage($('msg-longest'), result);
    if (byStudent) { countFlag('questions', 'longest', state.longest, result); saveState(); updateReportStatus(); }
  }

  function buildLimitRows() {
    var body = $('limit-rows');
    body.textContent = '';
    M.LIMIT_LEVELS.forEach(function (n) {
      var tr = el('tr');
      tr.appendChild(el('th', { scope: 'row' }, n.toLocaleString('en-US')));
      var eName = 'lde-' + n, wName = 'lwl-' + n, entry = state.limit[n];
      var eCell = el('td', { 'class': 'energy-cell' });
      var eInput = el('input', { type: 'text', id: eName, inputmode: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Energy change for a fall from level ' + n });
      eInput.value = entry.e;
      eCell.appendChild(eInput);
      eCell.appendChild(el('span', { 'class': 'unit' }, UNIT));
      tr.appendChild(eCell);
      var wCell = el('td');
      var wInput = el('input', { type: 'text', id: wName, inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Wavelength in nanometers for a fall from level ' + n });
      wInput.value = entry.w;
      wCell.appendChild(wInput);
      tr.appendChild(wCell);
      body.appendChild(tr);
      register(eName, 'limit', 'From n = ' + n.toLocaleString('en-US') + ', energy', eInput);
      register(wName, 'limit', 'From n = ' + n.toLocaleString('en-US') + ', wavelength', wInput);
      bindEntry(eInput, function (v) { entry.e = v; }, function () { focusOf.limit = eName; checkLimitRows(eName); });
      bindEntry(wInput, function (v) { entry.w = v; }, function () { focusOf.limit = wName; checkLimitRows(wName); });
    });
  }

  function checkLimitRows(changed) {
    M.LIMIT_LEVELS.forEach(function (n) {
      var entry = state.limit[n], eName = 'lde-' + n, wName = 'lwl-' + n;
      var eResult = M.checkLimitDelta(n, entry.e);
      setResult(eName, eResult);
      if (changed === eName) countFlag('questions', eName, entry.e, eResult);
      var wResult = M.checkLimitWavelength(n, entry.w, eResult.ok === true ? M.parseNumber(entry.e) : null);
      setResult(wName, wResult);
      if (changed === wName) countFlag('questions', wName, entry.w, wResult);
    });
    showGroup('limit');
    if (changed) { saveState(); updateReportStatus(); }
  }
  function limitAccepted() {
    var k = 0;
    M.LIMIT_LEVELS.forEach(function (n) { if (accepted('lde-' + n)) k++; if (accepted('lwl-' + n)) k++; });
    return k;
  }

  function checkTrend(byStudent) {
    var trend = M.checkTrend(state.trend), limit = M.checkLimit(state.limitValue);
    single.trend = trend;
    single.limit = limit;
    setState($('trend'), trend);
    setState($('limit-value'), limit);
    showMessage($('msg-trend'), trend.ok === false ? trend : limit);
    if (byStudent === 'trend') countFlag('questions', 'trend', state.trend, trend);
    if (byStudent === 'limit') countFlag('questions', 'limit', state.limitValue, limit);
    saveState();
    updateReportStatus();
  }

  function bindQuestions() {
    var end = $('common-end'), level = $('common-level');
    end.addEventListener('change', function () { state.common.end = end.value; checkCommon(true); });
    bindEntry(level, function (v) { state.common.level = v; $('common-end').removeAttribute('data-state'); }, function () { checkCommon(true); });
    bindEntry($('longest'), function (v) { state.longest = v; }, function () { checkLongest(true); });
    fillSelect($('trend'), M.TRENDS, state.trend);
    $('trend').addEventListener('change', function () { state.trend = $('trend').value; checkTrend('trend'); });
    bindEntry($('limit-value'), function (v) { state.limitValue = v; }, function () { checkTrend('limit'); });
    [['trend-why', 'trendWhy'], ['unknown-why', null]].forEach(function (pair) {
      var box = $(pair[0]);
      withPrintCopy(box);
      box.addEventListener('input', function () {
        if (pair[1]) state[pair[1]] = box.value; else state.unknown.why = box.value;
        syncPrintCopy(box);
        saveState();
        updateReportStatus();
      });
    });
  }

  // ---- Report ------------------------------------------------------------------------------------

  var MIN_REASON = 15;       // an explanation shorter than this is not counted as written

  function updateReportStatus() {
    if (!$('report-status')) return;
    var lines = acceptedLines().length, looks = ['look-lamp', 'look-tube', 'look-count'].filter(accepted).length;
    var uLines = unknownLinesAccepted(), mLines = matchLinesAccepted(), u = state.unknown;
    var unknownDone = uLines === M.UNKNOWN_LINES && mLines === M.UNKNOWN_LINES && !!u.match && !!u.glow && !!u.matchGlow && u.why.trim().length >= MIN_REASON;
    var levels = levelsAccepted(), jumps = jumpsAccepted(), match = matchAccepted(), limit = limitAccepted();
    var questions = [single.common, single.longest, single.trend, single.limit].filter(function (r) { return r && r.ok === true; }).length;
    var text;
    if (looks < 3) text = 'Still to do: the three short answers about what you see through the spectroscope, in part 1.';
    else if (lines < M.HYDROGEN_LINES) text = 'Still to do: ' + (M.HYDROGEN_LINES - lines) + ' of the 15 lines of hydrogen in Table 1.';
    else if (!unknownDone) text = 'Still to do: the unknown tube in part 2 (its glow, four lines, the tube that matches with the same four lines, and how you know).';
    else if (levels < M.LEVELS - 1) text = 'Still to do: ' + (M.LEVELS - 1 - levels) + ' of the energies in Table 3.';
    else if (jumps < 2 * M.JUMPS.length) text = 'Still to do: ' + (2 * M.JUMPS.length - jumps) + ' of the 30 entries in Table 4.';
    else if (match < M.HYDROGEN_LINES) text = 'Still to do: the jump behind ' + (M.HYDROGEN_LINES - match) + ' of the lines in Table 5.';
    else if (questions < 4 || limit < 2 * M.LIMIT_LEVELS.length || state.trendWhy.trim().length < MIN_REASON) text = 'Still to do: the questions in part 6.';
    else text = 'Everything is filled in. Add your name, then print or save the report as a PDF.';
    $('report-status').textContent = text;

    var f = state.flags, named = M.TUBES.filter(function (t) { return t.key === u.match; })[0];
    var matchName = named ? named.name : 'not chosen';
    $('print-name').textContent = 'Name: ' + (state.name || '________________');
    $('print-date').textContent = 'Printed ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    $('print-checks').textContent = 'Checked by the lab page for unknown tube ' + state.code + ': ' +
      lines + ' of 15 hydrogen lines accepted (' + f.lines + ' entries in part 1 flagged before correction); ' +
      (M.LEVELS - 1) + ' energies, ' + levels + ' accepted (' + f.levels + ' flagged); ' +
      jumps + ' of 30 entries of Table 4 accepted (' + f.jumps + ' flagged); ' +
      match + ' of 15 jumps accepted (' + f.match + ' flagged); questions flagged ' + f.questions + (f.questions === 1 ? ' time' : ' times') + '. ' +
      'Unknown tube: ' + uLines + ' of 4 measured lines accepted (' + f.unknown + ' entries flagged); gas named: ' + matchName +
      '. The page does not check which gas was named: mark that from the answer key.';
  }

  // ---- The 3D bench ----------------------------------------------------------------------------

  var unity = null;
  var unityAwake = false;
  var benchReady = false;     // the 3D lab has set out the bench and can check entries
  var persistentNote = { text: '', kind: '' };

  function sendBench(method, value) {
    if (!unity) return;
    try { unity.SendMessage('Lab', method, value == null ? '' : String(value)); } catch (e) { console.error(e); }
  }

  // A fresh lab opens on the whole fume hood and then moves in to the bench. Someone coming back
  // to work already under way starts at the bench, and ?intro=0 always does. Visitors who ask
  // their system for reduced motion get straight cuts between views and no opening move.
  var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function bench() { return state.bench || { holder: -1, power: false, lamp: false, lights: true, nm: 520, fine: false }; }
  function workUnderWay() {
    var b = state.bench;
    return !!b && (b.holder >= 0 || b.lamp || !b.lights || acceptedLines().length > 0 || state.lines.some(filled));
  }

  function configureBench() {
    if (!unity || !unityAwake) return;
    benchReady = false;
    sendBench('Configure', JSON.stringify({
      code: state.code,
      hasState: !!state.bench,
      state: state.bench || {},
      intro: params.get('intro') !== '0' && !calm && !workUnderWay(),
      calm: calm
    }));
  }

  // A step or warning note stays up for a few seconds before labels for whatever the pointer is
  // over take its place: the pointer is usually still over the thing it was just used on, and a
  // warning must be readable.
  var holdNoteUntil = 0;
  var pendingHover = null;
  var hoverTimer = null;
  var lastStep = '';

  function note(text, kind, temporary) {
    if (!temporary) {
      persistentNote = { text: text, kind: kind || '' };
      holdNoteUntil = Date.now() + (kind === 'warn' ? 4000 : 2200);
      pendingHover = null;
      lastStep = nextStep();
    }
    var node = $('stage-note');
    node.textContent = text;
    if (kind) node.setAttribute('data-kind', kind); else node.removeAttribute('data-kind');
  }

  // text: a label for what the pointer is over, or null when it is over nothing.
  function hoverNote(text) {
    clearTimeout(hoverTimer);
    var wait = holdNoteUntil - Date.now();
    if (wait > 0) {
      pendingHover = text;
      if (text !== null) hoverTimer = setTimeout(function () {
        if (pendingHover !== null) { var t = pendingHover; pendingHover = null; note(t, '', true); }
      }, wait);
      return;
    }
    pendingHover = null;
    if (text === null) note(persistentNote.text, persistentNote.kind, true);
    else note(text, '', true);
  }

  function nextStep() {
    if (lab.view === 'scope') return 'Through the spectroscope: drag the view or use the slider to move along the scale. The numbers are wavelengths in nanometers.';
    return M.nextStep(state.bench, { lines: acceptedLines().length });
  }

  // The standing note follows the bench as work goes on. When the next step changes, its new
  // wording replaces the note on show at once; a warning or a label on show stays until it is done.
  function updateNote() {
    if (!benchReady) return;
    var text = nextStep();
    if (text === lastStep) return;
    lastStep = text;
    var onShow = persistentNote.kind !== 'warn' && $('stage-note').textContent === persistentNote.text;
    persistentNote = { text: text, kind: '' };
    if (onShow) note(text, '', true);
  }

  function showView(view) {
    Array.prototype.forEach.call(document.querySelectorAll('.view-button'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-view') === view ? 'true' : 'false');
    });
    $('scope-controls').hidden = view !== 'scope';
  }

  // The buttons under the bench say what is switched on.
  function showSwitches() {
    var b = bench();
    $('switch-power').setAttribute('aria-pressed', b.power ? 'true' : 'false');
    $('switch-power').textContent = 'Power supply: ' + (b.power ? 'on' : 'off');
    $('switch-lamp').setAttribute('aria-pressed', b.lamp ? 'true' : 'false');
    $('switch-lamp').textContent = 'White lamp: ' + (b.lamp ? 'on' : 'off');
    $('switch-lights').setAttribute('aria-pressed', b.lights ? 'true' : 'false');
    $('switch-lights').textContent = 'Hood light: ' + (b.lights ? 'on' : 'off');
    Array.prototype.forEach.call(document.querySelectorAll('.tube-button'), function (button) {
      button.setAttribute('aria-pressed', +button.getAttribute('data-slot') === b.holder ? 'true' : 'false');
    });
    var slider = $('scope-slider');
    if (document.activeElement !== slider || !sliding) slider.value = String(b.nm);
    slider.setAttribute('aria-valuetext', 'near ' + Math.round(b.nm / 10) * 10 + ' nanometers');
    $('scope-fine').setAttribute('aria-pressed', b.fine ? 'true' : 'false');
    $('scope-fine').textContent = b.fine ? 'Wider view' : 'Closer view';
  }

  function takeBench(next) {
    if (!next || typeof next.holder !== 'number') return;
    state.bench = next;
  }

  function tubeWord(slot) { return slot === M.UNKNOWN ? 'The unknown tube' : 'The ' + M.TUBES[slot].name + ' tube'; }

  function hoverText(e) {
    var b = bench();
    switch (e.item) {
      case 'tube':
        if (!M.TUBES[e.n]) return null;
        if (e.standing) return tubeWord(e.n) + ', in the power supply. ' + (b.power ? 'Switch the supply off before you take it out.' : 'Click to put it back in the tray.');
        return tubeWord(e.n) + '. ' + (b.power ? 'Switch the supply off before you change tubes.' : 'Click to put it in the power supply.');
      case 'power':
        return 'Power supply: 5000 volts across the tube. Click to switch it ' + (b.power ? 'off.' : 'on.');
      case 'lamp':
        return 'White lamp: a hot wire in a glass bulb, behind the tube. Click to switch it ' + (b.lamp ? 'off.' : 'on.');
      case 'lights':
        return 'The hood’s own light. Click to switch it ' + (b.lights ? 'off.' : 'on.');
      case 'scope':
        return 'Spectroscope: a grating inside spreads the light along a scale of wavelengths. Click to look through it.';
      case 'screen':
        return 'The slit lets through a narrow beam; the prism bends each color by a different amount, onto the screen. Click for a closer look.';
      case 'detector':
        return 'Detector: it measures light of any wavelength, seen or unseen. Its chart is under the bench.';
    }
    return null;
  }

  function blockedText(e) {
    switch (e.reason) {
      case 'power-on':
        return 'Switch the power supply off first. It puts 5000 volts across the tube, and a lit tube is hot.';
      case 'no-tube':
        return 'There is no tube in the power supply. Choose one from the tray first.';
    }
    return '';
  }

  function onBenchEvent(json) {
    var e;
    try { e = JSON.parse(json); } catch (err) { return; }
    switch (e.type) {
      case 'ready':
        unityAwake = true;
        configureBench();
        break;
      case 'configured':
        $('stage-cover').hidden = true;
        if (e.code !== state.code) break;       // an answer to an earlier unknown
        takeBench(e.state);
        benchReady = true;
        saveState();
        showSwitches();
        note(nextStep());
        ask(Object.keys(remote), false);
        sweepAgain();
        break;
      case 'state':
        takeBench(e.state);
        saveState();
        showSwitches();
        note(nextStep());
        sweepAgain();
        break;
      case 'scope':
        if (state.bench) { state.bench.nm = e.nm; state.bench.fine = !!e.fine; }
        showSwitches();
        if (e.settled) saveState();
        break;
      case 'checked':
        takeVerdicts(e);
        break;
      case 'swept':
        takeSweep(e);
        break;
      case 'hover':
        hoverNote(hoverText(e));
        break;
      case 'clicked':
        if (e.item === 'detector') {
          $('detector').scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'nearest' });
          note('The detector’s chart is under the bench.');
        }
        break;
      case 'blocked':
        note(blockedText(e), 'warn');
        break;
      case 'reset':
        takeBench(e.state);
        saveState();
        showSwitches();
        note('Everything is back in its place. ' + nextStep());
        sweepAgain();
        break;
      case 'view':        // the camera has set off for this view
      case 'arrived':     // and has got there
        lab.view = e.view;
        showView(e.view);
        updateNote();
        break;
    }
  }

  var sliding = false;        // the student has hold of the spectroscope's slider

  function bindBenchControls() {
    Array.prototype.forEach.call(document.querySelectorAll('.view-button'), function (button) {
      button.addEventListener('click', function () { sendBench('SetView', button.getAttribute('data-view')); });
    });

    var holder = $('tube-buttons');
    M.TUBES.forEach(function (tube, slot) {
      var button = el('button', { type: 'button', 'class': 'quiet-button tube-button', 'data-slot': String(slot), 'aria-pressed': 'false',
        'aria-label': slot === M.UNKNOWN ? 'The unknown tube' : 'The ' + tube.name + ' tube', title: slot === M.UNKNOWN ? 'unknown' : tube.name }, tube.symbol);
      button.addEventListener('click', function () { sendBench('SelectTube', slot); });
      holder.appendChild(button);
    });
    $('switch-power').addEventListener('click', function () { sendBench('SetPower', 'flip'); });
    $('switch-lamp').addEventListener('click', function () { sendBench('SetLamp', 'flip'); });
    $('switch-lights').addEventListener('click', function () { sendBench('SetLights', 'flip'); });
    $('reset-bench').addEventListener('click', function () { sendBench('ResetBench', ''); });

    var slider = $('scope-slider');
    function look(nm, fine) { sendBench('SetScope', Math.max(M.SCOPE_FROM, Math.min(M.SCOPE_TO, nm)).toFixed(2) + ',' + (fine ? 1 : 0)); }
    slider.addEventListener('pointerdown', function () { sliding = true; });
    window.addEventListener('pointerup', function () { sliding = false; });
    slider.addEventListener('input', function () { look(+slider.value, bench().fine); });
    $('scope-left').addEventListener('click', function () { look(bench().nm - (bench().fine ? 2 : 10), bench().fine); });
    $('scope-right').addEventListener('click', function () { look(bench().nm + (bench().fine ? 2 : 10), bench().fine); });
    $('scope-fine').addEventListener('click', function () { look(bench().nm, !bench().fine); });

    // Let the page scroll when the wheel turns over the 3D view. The lab does not use the wheel,
    // but its engine would otherwise swallow it; this listener is registered first and on the
    // window, so it gets there before the engine's own.
    window.addEventListener('wheel', function (e) {
      if (e.target === $('unity-canvas')) e.stopImmediatePropagation();
    }, { capture: true, passive: true });

    window.addEventListener('pagehide', saveState);
    document.addEventListener('visibilitychange', function () { if (document.hidden) saveState(); });
  }

  // ---- The detector's chart -----------------------------------------------------------------------
  // The 3D lab sends a row of readings for a stretch of wavelengths; the chart draws them. The
  // chart is swept again whenever something on the bench is switched, so it always shows what is
  // lit now.

  var det = {
    from: M.DETECTOR_FROM, to: M.DETECTOR_TO,     // the stretch on show
    values: null, lit: null,
    marker: null,                                  // where the marker stands (nm), or null
    stack: [],                                     // stretches zoomed in from, for zooming out
    pending: 0, nextId: 1,
    drag: null                                     // { x0, x1 } while a stretch is being dragged out
  };
  var CHART = { left: 50, right: 12, top: 12, bottom: 48 };
  var MIN_SPAN = 2;           // the narrowest stretch the detector will sweep (nm)

  function sweep(from, to) {
    det.from = from;
    det.to = to;
    if (!benchReady) return;
    det.pending = det.nextId++;
    sendBench('Sweep', JSON.stringify({ id: det.pending, from: from, to: to, n: 900 }));
  }
  function sweepAgain() { sweep(det.from, det.to); }

  function takeSweep(e) {
    if (e.id !== det.pending || !Array.isArray(e.values)) return;
    det.from = e.from;
    det.to = e.to;
    det.values = e.values;
    det.lit = { power: !!e.power, lamp: !!e.lamp, lights: !!e.lights, holder: e.holder };
    if (det.marker !== null && (det.marker < det.from || det.marker > det.to)) det.marker = null;
    drawChart();
  }

  function decimalsFor(step) { return step >= 1 ? 0 : (step >= 0.1 ? 1 : 2); }

  // The color of light of one wavelength, for the strip under the chart.
  function hue(nm) {
    var r = 0, g = 0, b = 0;
    if (nm < 380 || nm > 770) return null;
    if (nm < 440) { r = (440 - nm) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
    else r = 1;
    var f = nm < 420 ? 0.35 + 0.65 * (nm - 380) / 40 : (nm > 700 ? 0.35 + 0.65 * (770 - nm) / 70 : 1);
    function c(v) { return Math.round(255 * Math.pow(Math.max(0, v) * f, 0.8)); }
    return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')';
  }

  function niceStep(span, most) {
    var steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    for (var i = 0; i < steps.length; i++) if (span / steps[i] <= most) return steps[i];
    return 1000;
  }

  function chartBox() {
    var canvas = $('detector-canvas');
    return { canvas: canvas, w: canvas.clientWidth, h: canvas.clientHeight };
  }
  function nmAtX(x) {
    var box = chartBox(), inner = box.w - CHART.left - CHART.right;
    return det.from + Math.max(0, Math.min(1, (x - CHART.left) / inner)) * (det.to - det.from);
  }
  function xAtNm(nm, box) {
    return CHART.left + (nm - det.from) / (det.to - det.from) * (box.w - CHART.left - CHART.right);
  }

  function drawChart() {
    var box = chartBox(), canvas = box.canvas;
    if (!box.w || !box.h) return;
    var ratio = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(box.w * ratio) || canvas.height !== Math.round(box.h * ratio)) {
      canvas.width = Math.round(box.w * ratio);
      canvas.height = Math.round(box.h * ratio);
    }
    var g = canvas.getContext('2d');
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, box.w, box.h);
    var style = getComputedStyle(document.documentElement);
    var ink = style.getPropertyValue('--ink').trim() || '#17211e', soft = style.getPropertyValue('--ink-soft').trim() || '#55605c';
    var rule = style.getPropertyValue('--rule').trim() || '#d5d9d6', enamel = style.getPropertyValue('--enamel').trim() || '#1c4c9a';
    var x0 = CHART.left, x1 = box.w - CHART.right, y0 = CHART.top, y1 = box.h - CHART.bottom;
    var top = 110;
    function y(v) { return y1 - Math.max(0, Math.min(top, v)) / top * (y1 - y0); }

    // the strip that says which light is which: ultraviolet, the colors the eye sees, infrared
    for (var px = Math.floor(x0); px < x1; px++) {
      var nm = det.from + (px + 0.5 - x0) / (x1 - x0) * (det.to - det.from);
      g.fillStyle = hue(nm) || (nm < 380 ? '#4a4460' : '#5a3d3a');
      g.fillRect(px, y1 + 1, 1.2, 7);
    }
    g.font = '11px ' + (style.getPropertyValue('--sans').trim() || 'system-ui, sans-serif');
    g.textBaseline = 'alphabetic';

    // grid and axis numbers
    g.strokeStyle = rule;
    g.fillStyle = soft;
    g.lineWidth = 1;
    g.textAlign = 'right';
    [0, 25, 50, 75, 100].forEach(function (v) {
      g.beginPath(); g.moveTo(x0, Math.round(y(v)) + 0.5); g.lineTo(x1, Math.round(y(v)) + 0.5); g.stroke();
      g.fillText(String(v), x0 - 6, y(v) + 4);
    });
    var span = det.to - det.from, step = niceStep(span, Math.max(3, Math.floor((x1 - x0) / 70)));
    g.textAlign = 'center';
    for (var t = Math.ceil(det.from / step - 1e-9) * step; t <= det.to + 1e-9; t += step) {
      var tx = xAtNm(t, box);
      g.beginPath(); g.moveTo(Math.round(tx) + 0.5, y1 + 8); g.lineTo(Math.round(tx) + 0.5, y1 + 13); g.stroke();
      g.fillText(step < 1 ? t.toFixed(1) : String(Math.round(t)), tx, y1 + 25);
    }
    g.fillText('wavelength (nm)', (x0 + x1) / 2, box.h - 4);
    g.save();
    g.translate(11, (y0 + y1) / 2);
    g.rotate(-Math.PI / 2);
    g.fillText('reading', 0, 0);
    g.restore();

    // the readings
    if (det.values) {
      var n = det.values.length;
      g.beginPath();
      for (var i = 0; i < n; i++) {
        var vx = x0 + (i + 0.5) / n * (x1 - x0), vy = y(det.values[i]);
        if (i === 0) g.moveTo(vx, vy); else g.lineTo(vx, vy);
      }
      g.strokeStyle = ink;
      g.lineWidth = 1.4;
      g.stroke();
      g.lineTo(x1, y1); g.lineTo(x0, y1); g.closePath();
      g.fillStyle = 'rgba(23, 33, 30, 0.07)';
      g.fill();
    } else {
      g.textAlign = 'center';
      g.fillStyle = soft;
      g.fillText('Waiting for the 3D lab', (x0 + x1) / 2, (y0 + y1) / 2);
    }

    // a stretch being dragged out, and the marker
    if (det.drag) {
      g.fillStyle = 'rgba(28, 76, 154, 0.16)';
      g.fillRect(Math.min(det.drag.x0, det.drag.x1), y0, Math.abs(det.drag.x1 - det.drag.x0), y1 - y0);
    }
    if (det.marker !== null && det.values) {
      var mx = Math.round(xAtNm(det.marker, box)) + 0.5;
      g.strokeStyle = enamel;
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(mx, y0); g.lineTo(mx, y1 + 8); g.stroke();
    }
    showReadout();
  }

  function readingAt(nm) {
    if (!det.values) return null;
    var n = det.values.length, i = Math.max(0, Math.min(n - 1, Math.floor((nm - det.from) / (det.to - det.from) * n)));
    return det.values[i];
  }

  function showReadout() {
    var node = $('detector-readout');
    if (!det.values) { node.textContent = ' '; return; }
    var step = (det.to - det.from) / det.values.length, places = decimalsFor(step);
    var lit = det.lit || {}, what = [];
    if (lit.power) what.push(lit.holder === M.UNKNOWN ? 'the unknown tube' : (M.TUBES[lit.holder] ? M.TUBES[lit.holder].name : 'a tube'));
    if (lit.lamp) what.push('the white lamp');
    var source = what.length ? 'Looking at ' + what.join(' and ') : 'Nothing is lit';
    if (lit.lights) source += ' (hood light on)';
    if (det.marker === null) { node.textContent = source + '. Click the chart to place the marker.'; return; }
    var text = source + '. Marker at ' + det.marker.toFixed(places) + ' nm, reading ' + readingAt(det.marker).toFixed(1) + '.';
    if (places < 1) text += ' Zoom in to read it more finely.';
    node.textContent = text;
  }

  function clampSpan(from, to) {
    var span = Math.max(MIN_SPAN, Math.min(M.DETECTOR_TO - M.DETECTOR_FROM, to - from));
    var mid = (from + to) / 2;
    from = mid - span / 2;
    to = mid + span / 2;
    if (from < M.DETECTOR_FROM) { to += M.DETECTOR_FROM - from; from = M.DETECTOR_FROM; }
    if (to > M.DETECTOR_TO) { from -= to - M.DETECTOR_TO; to = M.DETECTOR_TO; }
    return [Math.max(M.DETECTOR_FROM, from), Math.min(M.DETECTOR_TO, to)];
  }
  function zoomTo(from, to) {
    var next = clampSpan(from, to);
    if (Math.abs(next[0] - det.from) < 1e-6 && Math.abs(next[1] - det.to) < 1e-6) return;
    det.stack.push([det.from, det.to]);
    if (det.stack.length > 30) det.stack.shift();
    sweep(next[0], next[1]);
  }
  // one step of the marker: one reading along
  function nudge(by) {
    if (!det.values) return;
    var step = (det.to - det.from) / det.values.length;
    var at = det.marker === null ? (det.from + det.to) / 2 : det.marker + by * step;
    det.marker = Math.max(det.from, Math.min(det.to, at));
    drawChart();
  }

  function bindDetector() {
    var canvas = $('detector-canvas');
    function local(e) { return e.clientX - canvas.getBoundingClientRect().left; }
    canvas.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      det.drag = { x0: local(e), x1: local(e), moved: false };
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!det.drag) return;
      det.drag.x1 = local(e);
      if (Math.abs(det.drag.x1 - det.drag.x0) > 6) det.drag.moved = true;
      if (det.drag.moved) drawChart();
    });
    function finish(e) {
      if (!det.drag) return;
      var drag = det.drag;
      det.drag = null;
      if (drag.moved && e.type === 'pointerup') {
        var a = nmAtX(Math.min(drag.x0, drag.x1)), b = nmAtX(Math.max(drag.x0, drag.x1));
        det.marker = null;
        zoomTo(a, b);
      } else if (e.type === 'pointerup') {
        det.marker = nmAtX(drag.x1);
      }
      drawChart();
    }
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.setAttribute('tabindex', '0');
    canvas.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(e.shiftKey ? -10 : -1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); nudge(e.shiftKey ? 10 : 1); }
    });
    $('detector-left').addEventListener('click', function () { nudge(-1); });
    $('detector-right').addEventListener('click', function () { nudge(1); });
    $('detector-in').addEventListener('click', function () {
      var mid = det.marker === null ? (det.from + det.to) / 2 : det.marker, span = (det.to - det.from) / 5;
      zoomTo(mid - span / 2, mid + span / 2);
    });
    $('detector-out').addEventListener('click', function () {
      var back = det.stack.pop();
      if (back) { sweep(back[0], back[1]); return; }
      var mid = (det.from + det.to) / 2, span = (det.to - det.from) * 5;
      var next = clampSpan(mid - span / 2, mid + span / 2);
      sweep(next[0], next[1]);
    });
    $('detector-all').addEventListener('click', function () { det.stack = []; sweep(M.DETECTOR_FROM, M.DETECTOR_TO); });
    window.addEventListener('resize', drawChart);
  }

  // ---- Name, print, a new unknown --------------------------------------------------------------

  function bindReport() {
    var nameInput = $('student-name');
    nameInput.addEventListener('input', function () { state.name = nameInput.value; saveState(); updateReportStatus(); });
    $('print-report').addEventListener('click', function () { window.print(); });
    window.addEventListener('beforeprint', updateReportStatus);

    $('new-unknown').addEventListener('click', function () {
      $('new-unknown').hidden = true;
      $('new-confirm').hidden = false;
      $('new-no').focus();
    });
    $('new-no').addEventListener('click', function () {
      $('new-confirm').hidden = true;
      $('new-unknown').hidden = false;
    });
    $('new-yes').addEventListener('click', function () {
      state = blankState();
      verdicts = {};
      lastFlagged = {};
      toCount = {};
      single = {};
      focusOf = {};
      det.stack = [];
      det.marker = null;
      det.from = M.DETECTOR_FROM;
      det.to = M.DETECTOR_TO;
      saveState();
      // a link that named the old unknown must not bring it back on the next visit
      if (params.has('code') && window.history && window.history.replaceState) {
        params.delete('code');
        var rest = params.toString();
        window.history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : ''));
      }
      $('new-confirm').hidden = true;
      $('new-unknown').hidden = false;
      refreshAll();
      configureBench();
      window.scrollTo({ top: 0 });
    });
  }

  // puts everything in the saved work back on the page
  function refreshAll() {
    $('unknown-code').textContent = state.code;
    matchSignature = null;
    $('look-lamp').value = state.looks.lamp;
    $('look-tube').value = state.looks.tube;
    $('look-count').value = state.looks.count;
    buildLineGrid();
    buildUnknownRows();
    buildLevelRows();
    buildJumpRows();
    buildLimitRows();
    $('common-end').value = state.common.end;
    $('common-level').value = state.common.level;
    $('longest').value = state.longest;
    $('trend').value = state.trend;
    $('limit-value').value = state.limitValue;
    $('trend-why').value = state.trendWhy;
    $('unknown-why').value = state.unknown.why;
    syncPrintCopy($('trend-why'));
    syncPrintCopy($('unknown-why'));
    $('student-name').value = state.name;
    showSwitches();
    checkLevels();
    checkLimitRows();
    checkCommon();
    checkTrend();
    showRemote();
    buildMatchRows(true);
    checkLongest();
    updateReportStatus();
    drawChart();
  }

  // ---- Wiring for the Unity loader in index.html ---------------------------------------------------

  var lab = window.SpectrumLab = {
    isMock: !!standIn,      // true when a test stand-in replaces the 3D lab
    view: 'bench',          // which camera view the 3D lab is showing or moving to
    onUnityEvent: onBenchEvent,
    attachUnity: function (instance) { unity = instance; configureBench(); },
    unityProgress: function (fraction) {
      $('progress-fill').style.width = Math.round(Math.max(0.04, fraction) * 100) + '%';
    },
    unityFailed: function (error) {
      console.error(error);
      var cover = $('stage-cover');
      cover.hidden = false;
      cover.setAttribute('data-state', 'failed');
      $('stage-status').textContent = 'The 3D lab could not start in this browser. Open this page in a current version of Chrome, Edge, Firefox or Safari on a computer.';
      document.querySelector('.progress').hidden = true;
    },
    unityBanner: function (message, type) {
      if (type === 'error') lab.unityFailed(message); else console.warn(message);
    }
  };

  bindLooks();
  bindQuestions();
  bindBenchControls();
  bindDetector();
  bindReport();
  refreshAll();
  saveState();

  // ---- Stand-in for the 3D lab, supplied by automated tests -------------------------------------

  if (standIn) {
    unity = standIn(onBenchEvent);
    onBenchEvent('{"type":"ready"}');
  }
})();
