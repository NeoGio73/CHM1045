/*
 * Calorimetry and Hess's Law: the page's checking logic. No page or Unity code here, so it loads
 * in Node for tests (node Tools/cal_model_test.js). Nothing in this lab is secret except the
 * calorimeter's true heat capacity, which stays in Unity: the readings are checked against what
 * the bench recorded (its state, sent by Unity), and every calculation against the student's own
 * accepted numbers.
 */
(function (root) {
  'use strict';

  var WATER_S = 4.184;            // J/(g C), the handout's value
  var DENSITY = 1.00;             // g/mL, the handout's assumption
  var MG_MOLAR = 24.305, MGO_MOLAR = 40.304;
  var DHF_WATER = -285.84;        // kJ/mol, given in the handout (Rxn 5)
  var TEXTBOOK_MGO = -601.6;      // kJ/mol, standard enthalpy of formation of MgO(s)

  // ---- codes: four letters or digits and a check character --------------------------------------

  var ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  function normalizeCode(text) { return String(text == null ? '' : text).toUpperCase().replace(/[^0-9A-Z]/g, ''); }
  function checkChar(digits) {
    var sum = 0;
    for (var i = 0; i < digits.length; i++) sum += (i + 3) * digits[i];
    return ALPHABET[sum % ALPHABET.length];
  }
  function isCode(text) {
    var code = normalizeCode(text);
    if (code.length !== 5) return false;
    var digits = [];
    for (var i = 0; i < 4; i++) { var d = ALPHABET.indexOf(code[i]); if (d < 0) return false; digits.push(d); }
    return checkChar(digits) === code[4];
  }
  function randomCode() {
    var digits = [];
    for (var i = 0; i < 4; i++) {
      var n;
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) { var b = new Uint32Array(1); crypto.getRandomValues(b); n = b[0]; }
      else n = Math.floor(Math.random() * 1e9);
      digits.push(n % ALPHABET.length);
    }
    return digits.map(function (d) { return ALPHABET[d]; }).join('') + checkChar(digits);
  }

  // ---- numbers ----------------------------------------------------------------------------------

  /** A number typed by a student: allows a leading +, a minus sign of any kind, commas as thousands, and x10^ or e notation. Units are printed beside the box. */
  function parseNumber(text) {
    var s = String(text == null ? '' : text).trim().replace(/[−–—]/g, '-').replace(/\s+/g, '');
    if (!s) return null;
    s = s.replace(/(\d),(\d{3})(?!\d)/g, '$1$2');
    var m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(?:(?:[x×*]10\^?|e)([+-]?\d+))?$/i);
    if (!m) return NaN;
    var v = parseFloat(m[1]);
    if (m[2] != null) v *= Math.pow(10, parseInt(m[2], 10));
    return v;
  }

  function close(value, target, rel, abs) {
    return Math.abs(value - target) <= Math.max(Math.abs(target) * (rel || 0), abs || 0);
  }

  function round(v, places) { var f = Math.pow(10, places); return Math.round(v * f) / f; }

  /** Decimal places a typed number shows ("50.0" -> 1). */
  function places(text) {
    var s = String(text).trim();
    var m = s.match(/\.(\d+)/);
    return m ? m[1].length : 0;
  }

  // ---- the logger's runs ---------------------------------------------------------------------------

  function fitLine(t, c) {
    var n = t.length;
    if (n < 2) return null;
    var st = 0, sc = 0, stt = 0, stc = 0;
    for (var i = 0; i < n; i++) { st += t[i]; sc += c[i]; stt += t[i] * t[i]; stc += t[i] * c[i]; }
    var d = n * stt - st * st;
    if (Math.abs(d) < 1e-12) return null;
    var m = (n * stc - st * sc) / d;
    var b = (sc - m * st) / n;
    return { m: m, b: b, n: n };
  }

  function fitRange(run, t0, t1) {
    var t = [], c = [];
    for (var i = 0; i < run.t.length; i++) if (run.t[i] >= t0 && run.t[i] <= t1) { t.push(run.t[i]); c.push(run.c[i]); }
    return fitLine(t, c);
  }

  /** The temperature before mixing: the mean of the last 10 s of readings before `addedAt`. */
  function startTemperature(run) {
    if (!run || run.addedAt == null || run.addedAt < 0) return null;
    var sum = 0, n = 0;
    for (var i = 0; i < run.t.length; i++) if (run.t[i] < run.addedAt && run.t[i] >= run.addedAt - 10) { sum += run.c[i]; n++; }
    if (!n) for (var j = 0; j < run.t.length && run.t[j] < run.addedAt; j++) { sum += run.c[j]; n++; }
    return n ? sum / n : null;
  }

  /**
   * The page's own Tf: a line through the cooling part of the run (from 60 s after the highest
   * reading to the end), taken back to the moment of mixing. Null if the run is too short.
   */
  function referenceTf(run) {
    if (!run || run.addedAt == null || run.addedAt < 0 || run.t.length < 10) return null;
    var peakI = -1, peak = -1e9;
    for (var i = 0; i < run.t.length; i++) if (run.t[i] > run.addedAt && run.c[i] > peak) { peak = run.c[i]; peakI = i; }
    if (peakI < 0) return null;
    var from = Math.max(run.t[peakI] + 60, run.addedAt + 90);
    var end = run.t[run.t.length - 1];
    if (end - from < 60) return null;
    var fit = fitRange(run, from, end);
    if (!fit) return null;
    return { tf: fit.m * run.addedAt + fit.b, fit: fit, from: from, to: end };
  }

  // ---- what the page says about a refused step ----------------------------------------------------

  var BLOCKED = {
    unknown: 'That step is not one the bench knows.',
    cannotTake: 'That stays where it is. Click something you can pick up.',
    handsFull: 'Your hand is full. Click what you are holding again to put it down, or use it on something.',
    probeRunning: 'The probe is recording. Leave it in the calorimeter until the run is stopped.',
    notThisPart: 'That is not used in this part of the experiment. Check which part is selected above the bench.',
    beakerLow: 'There is not enough hot water left in the beaker for another 50 mL.',
    cylinderEmpty: 'The graduated cylinder is empty.',
    nothingHeld: 'Pick something up first.',
    wrongTarget: 'That does not go there.',
    cylinderHasOther: 'The cylinder holds something else. Pour it out first (into the calorimeter, or the waste).',
    cylinderFull: 'The cylinder is full to 100 mL.',
    cupNotEmpty: 'The calorimeter already has liquid in it.',
    cupDirty: 'The calorimeter has been used. Empty it, then rinse and dry it, before you start again.',
    cupWet: 'The calorimeter is wet. Rinse and dry it first: water left in the cup would dilute the acid.',
    noColdYet: 'Put the cold water in the calorimeter first. The hot water goes in second.',
    alreadyMixed: 'This part has already been mixed. To do it again, empty, rinse and dry the cup and start the part over.',
    paperNotOnBalance: 'Put the weighing paper on the balance first, so you can see how much you add.',
    paperHasOther: 'The paper already holds a different solid.',
    paperEmpty: 'There is nothing on the weighing paper.',
    noAcidYet: 'Put the HCl in the calorimeter first. The solid goes in second.',
    cupEmpty: 'The calorimeter is empty.',
    stillCollecting: 'The software is still collecting. Stop the run first.',
    acidInSink: 'Acid and magnesium salts go into the waste beaker in the hood, not down the sink.',
    alreadyCollecting: 'The software is already collecting.',
    badPart: 'There are three parts: I, II and III.'
  };

  function blockedText(reason) { return BLOCKED[reason] || ('The bench refused that step (' + reason + ').'); }

  // ---- checking a reading or a calculation -----------------------------------------------------------

  function result(ok, message) { return { ok: ok, message: message || '' }; }

  /** Screens a typed number: empty, not a number. Returns null when it is a number to check. */
  function screen(text) {
    var v = parseNumber(text);
    if (v === null) return result(null, '');
    if (isNaN(v)) return result(false, 'Type a number only: the unit is printed beside the box.');
    return null;
  }

  function checkVolume(text, recordedMl, what) {
    var s = screen(text); if (s) return s;
    if (recordedMl == null || recordedMl < 0) return result(false, 'No ' + what + ' has been measured in this part yet.');
    var v = parseNumber(text);
    if (places(text) < 1) return result(false, 'A 100 mL cylinder is read to the nearest 0.1 mL: give one decimal place.');
    if (close(v, recordedMl, 0, 0.21)) return result(true, '');
    return result(false, 'That is not what the cylinder held. Read the bottom of the meniscus in the cylinder close-up before you pour.');
  }

  function checkHotTemperature(text, rec) {
    var s = screen(text); if (s) return s;
    if (!rec || rec.hotMl < 0) return result(false, 'The hot water has not gone into the calorimeter yet.');
    var v = parseNumber(text);
    if (places(text) < 1) return result(false, 'The thermometer reads to 0.1 °C: give one decimal place.');
    if (close(v, rec.hotC, 0, 0.5)) return result(true, '');
    if (rec.hotWhere === 'beaker' || v > rec.hotC + 0.5) return result(false, 'The water was cooler than that when it went in. Measure it in the cylinder, just before you pour: the cylinder takes heat from it.');
    return result(false, 'That is not the temperature of the hot water when it was poured. Keep the thermometer in the cylinder until you pour, and read it just before.');
  }

  function checkStartTemperature(text, run) {
    var s = screen(text); if (s) return s;
    var ref = startTemperature(run);
    if (ref == null) return result(false, 'Your run has no readings from before the second reagent went in. Collect for about 10 s before you add it.');
    var v = parseNumber(text);
    if (close(v, ref, 0, 0.15)) return result(true, '');
    return result(false, 'Read the steady temperature on your graph just before the mixing line.');
  }

  function checkMass(text, rec) {
    var s = screen(text); if (s) return s;
    if (!rec || rec.solidG < 0) return result(false, 'No solid has gone into the calorimeter in this part yet.');
    var v = parseNumber(text);
    if (places(text) < 3) return result(false, 'The balance reads to 0.001 g: give three decimal places.');
    if (close(v, rec.solidG, 0, 0.0011)) return result(true, '');
    if (!rec.solidTared && close(v, rec.solidShown, 0, 0.0011))
      return result(false, 'That reading includes the weighing paper. Zero the balance with the empty paper on it before adding the solid. For now, subtract the paper’s mass if you know it, or redo the part.');
    return result(false, 'That is not what the balance showed for the solid just before it went into the cup.');
  }

  function checkTf(text, run) {
    var s = screen(text); if (s) return s;
    var ref = referenceTf(run);
    if (!ref) return result(false, 'This run is too short to find Tₓ by extrapolation. Collect for the full time after mixing.'.replace('ₓ', 'f'));
    var v = parseNumber(text);
    if (close(v, ref.tf, 0, 0.3)) return result(true, '');
    if (Math.abs(v - ref.tf) < 2) return result(false, 'Close, but not the extrapolated value. Fit a line to the slow cooling part only (well after the peak), and read it at the mixing line, not at the peak.');
    return result(false, 'Tₓ is where the line through the cooling part, carried back, crosses the time of mixing.'.replace('ₓ', 'f'));
  }

  /** A calculated value, checked against the student's own numbers. */
  function checkCalc(text, expected, opts) {
    opts = opts || {};
    var s = screen(text); if (s) return s;
    if (expected == null || !isFinite(expected)) return result(false, opts.waiting || 'Finish the entries above this one first.');
    var v = parseNumber(text);
    var rel = opts.rel != null ? opts.rel : 0.015, abs = opts.abs != null ? opts.abs : 0;
    if (close(v, expected, rel, abs)) return result(true, '');
    if (close(-v, expected, rel, abs) && Math.abs(expected) > 1e-9) return result(false, opts.sign || 'Check the sign.');
    if (opts.factor && close(v * opts.factor, expected, rel, abs)) return result(false, opts.factorText);
    return result(false, opts.wrong || 'Check this calculation with your own numbers above.');
  }

  // ---- the numbers each calculation should give, from the student's accepted entries -------------------

  function part1(e) {
    // e: coldV, coldT, hotV, hotT, tf (numbers or null)
    var o = {};
    if (e.coldV != null) o.mCold = e.coldV * DENSITY;
    if (e.hotV != null) o.mHot = e.hotV * DENSITY;
    if (o.mCold != null && e.tf != null && e.coldT != null) o.qCold = o.mCold * WATER_S * (e.tf - e.coldT);
    if (o.mHot != null && e.tf != null && e.hotT != null) o.qHot = o.mHot * WATER_S * (e.tf - e.hotT);
    if (o.qCold != null && o.qHot != null) o.qCal = -(o.qCold + o.qHot);
    if (o.qCal != null && e.tf != null && e.coldT != null && Math.abs(e.tf - e.coldT) > 1e-6) o.cCal = o.qCal / (e.tf - e.coldT);
    return o;
  }

  function reactionPart(e, molar) {
    // e: acidV, startT, mass, tf, cCal
    var o = {};
    if (e.acidV != null) o.mSoln = e.acidV * DENSITY;
    if (e.tf != null && e.startT != null) o.dT = e.tf - e.startT;
    if (o.mSoln != null && o.dT != null) o.qSoln = o.mSoln * WATER_S * o.dT;
    if (e.cCal != null && o.dT != null) o.qCal = e.cCal * o.dT;
    if (o.qSoln != null && o.qCal != null) o.qRxn = -(o.qSoln + o.qCal);
    if (o.qRxn != null && e.mass != null && e.mass > 0) { o.moles = e.mass / molar; o.dH = o.qRxn / o.moles / 1000; }
    return o;
  }

  function hess(dH3, dH4) {
    if (dH3 == null || dH4 == null) return null;
    return dH3 - dH4 + DHF_WATER;
  }

  function percentError(exp, truth) {
    if (exp == null || truth == null || truth === 0) return null;
    return (exp - truth) / truth * 100;
  }

  var api = {
    WATER_S: WATER_S, DENSITY: DENSITY, MG_MOLAR: MG_MOLAR, MGO_MOLAR: MGO_MOLAR, DHF_WATER: DHF_WATER, TEXTBOOK_MGO: TEXTBOOK_MGO,
    normalizeCode: normalizeCode, isCode: isCode, randomCode: randomCode,
    parseNumber: parseNumber, places: places, round: round, close: close,
    fitLine: fitLine, fitRange: fitRange, startTemperature: startTemperature, referenceTf: referenceTf,
    blockedText: blockedText, BLOCKED: BLOCKED,
    checkVolume: checkVolume, checkHotTemperature: checkHotTemperature, checkStartTemperature: checkStartTemperature,
    checkMass: checkMass, checkTf: checkTf, checkCalc: checkCalc,
    part1: part1, reactionPart: reactionPart, hess: hess, percentError: percentError
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalLabModel = api;
})(this);
