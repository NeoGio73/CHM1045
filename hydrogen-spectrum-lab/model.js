/*
 * The Atomic Spectrum of Hydrogen: the page's model.
 * Unknown codes, reading a number off what a student typed, the checks of everything that follows
 * from the equations printed on the page (the energy of each level, the energy change and the
 * wavelength of each jump, which jump gives which measured line), and the wording of the messages.
 *
 * It holds no list of any gas's lines and nothing about any student's unknown tube. A measured
 * wavelength is judged inside the 3D lab, against the tube it was measured on. Which gas the
 * unknown is, is never checked at all: the instructor marks that from the answer key.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpectrumLabModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- The bench, as the page names it -------------------------------------------------------

  // The tubes, in the order of their places in the tray. The last one is the unknown.
  var TUBES = [
    { key: 'h', symbol: 'H₂', name: 'hydrogen' },
    { key: 'he', symbol: 'He', name: 'helium' },
    { key: 'ne', symbol: 'Ne', name: 'neon' },
    { key: 'ar', symbol: 'Ar', name: 'argon' },
    { key: 'kr', symbol: 'Kr', name: 'krypton' },
    { key: 'hg', symbol: 'Hg', name: 'mercury' },
    { key: 'unknown', symbol: '?', name: 'unknown' }
  ];
  var HYDROGEN = 0, UNKNOWN = 6;
  var REFERENCES = [1, 2, 3, 4, 5];       // the tubes the unknown may match

  var HYDROGEN_LINES = 15;                // how many lines of hydrogen are within reach of this bench
  var UNKNOWN_LINES = 4;                  // how many of the unknown's lines are measured as evidence

  // What a glow may be called. Nothing here says which gas glows which color.
  var GLOWS = [
    { value: 'pink', text: 'pink' },
    { value: 'peach', text: 'pale orange or peach' },
    { value: 'orange', text: 'orange-red' },
    { value: 'violet', text: 'violet' },
    { value: 'white', text: 'bluish white' },
    { value: 'blue', text: 'pale blue' }
  ];

  // What a source's light may look like through the spectroscope.
  var LOOKS = [
    { value: 'band', text: 'one unbroken band of every color' },
    { value: 'lines', text: 'a few separate lines with dark between them' },
    { value: 'one', text: 'a single color' }
  ];

  var SCOPE_FROM = 380, SCOPE_TO = 760;   // where the middle of the spectroscope's view may be (nm)
  var EYE_FROM = 380, EYE_TO = 770;       // the colors the eye sees, and the spectroscope's scale
  var DETECTOR_FROM = 80, DETECTOR_TO = 4200;

  function tubeName(slot) {
    if (slot === UNKNOWN) return 'the unknown tube';
    return TUBES[slot] ? 'the ' + TUBES[slot].name + ' tube' : 'a tube';
  }

  // ---- Unknown codes ---------------------------------------------------------------------------
  // A code is four characters plus one check character, e.g. "K7Q4M", the same form as the
  // density lab's. The check character catches typing mistakes when the instructor looks a code up.

  var ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/1/I/L/O
  var BASE = ALPHABET.length;                         // 31
  var CODE_SPACE = BASE * BASE * BASE * BASE;

  function checkChar(digits) {
    var sum = 7;
    for (var i = 0; i < digits.length; i++) sum += (i + 2) * digits[i];
    return ALPHABET[sum % BASE];
  }
  function codeFromNumber(n) {
    n = ((n % CODE_SPACE) + CODE_SPACE) % CODE_SPACE;
    var digits = [];
    for (var i = 0; i < 4; i++) { digits.unshift(n % BASE); n = Math.floor(n / BASE); }
    return digits.map(function (d) { return ALPHABET[d]; }).join('') + checkChar(digits);
  }
  function normalizeCode(text) {
    return String(text == null ? '' : text).toUpperCase().replace(/[^0-9A-Z]/g, '');
  }
  function numberFromCode(text) {
    var code = normalizeCode(text);
    if (code.length !== 5) return null;
    var digits = [];
    for (var i = 0; i < 4; i++) {
      var d = ALPHABET.indexOf(code[i]);
      if (d < 0) return null;
      digits.push(d);
    }
    if (checkChar(digits) !== code[4]) return null;
    return ((digits[0] * BASE + digits[1]) * BASE + digits[2]) * BASE + digits[3];
  }
  function isCode(text) { return numberFromCode(text) !== null; }
  function randomCode() {
    var n;
    try {
      var box = new Uint32Array(1);
      (typeof crypto !== 'undefined' ? crypto : require('crypto').webcrypto).getRandomValues(box);
      n = box[0] % CODE_SPACE;
    } catch (e) {
      n = Math.floor(Math.random() * CODE_SPACE);
    }
    return codeFromNumber(n);
  }

  // ---- Reading a number ----------------------------------------------------------------------------

  // What a student typed, as a number, or null. A typed minus sign may be any of the dashes a
  // keyboard or a phone offers, and a decimal comma is read as a point.
  function parseNumber(text) {
    var s = String(text == null ? '' : text).trim();
    if (!s) return null;
    s = s.replace(/[−‒–—]/g, '-').replace(/\s+/g, '');
    if (/^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');   // 10,000
    else s = s.replace(',', '.');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
    var v = Number(s);
    return isFinite(v) ? v : null;
  }
  function hasDecimal(text) { return /[.,]\d/.test(String(text == null ? '' : text)); }
  function within(value, target, fraction) { return Math.abs(value - target) <= Math.abs(target) * fraction; }

  function blank() { return { ok: null, message: '' }; }
  function good(message) { return { ok: true, message: message || '' }; }
  function bad(message) { return { ok: false, message: message }; }

  // ---- The equations ---------------------------------------------------------------------------------
  // Energies are in units of 10^-18 joule throughout, as the tables ask for them.

  var RYDBERG = 2.18;                       // x 10^-18 J
  var HC = 6.626e-34 * 2.998e8;             // Planck's constant times the speed of light, J m
  var HC_NM = HC * 1e9 / 1e-18;             // so that wavelength in nm = HC_NM / (energy in 10^-18 J)
  var LEVELS = 10;
  var GIVEN_LEVEL = 3;                      // the table shows this one as an example
  var ENERGY_TOLERANCE = 0.015;
  var WAVELENGTH_TOLERANCE = 0.01;

  function energy(n) { return -RYDBERG / (n * n); }
  // The energy change of the electron when it falls from `hi` to `lo`: final minus initial, so negative.
  function deltaE(hi, lo) { return -RYDBERG * (1 / (lo * lo) - 1 / (hi * hi)); }
  function wavelength(hi, lo) { return HC_NM / Math.abs(deltaE(hi, lo)); }

  // The right digits with the decimal point in the wrong place.
  function wrongPower(value, target) {
    for (var k = -4; k <= 4; k++) if (k !== 0 && within(value * Math.pow(10, k), target, ENERGY_TOLERANCE)) return true;
    return false;
  }

  // Table 3: the energy of level n.
  function checkEnergy(n, text) {
    if (!String(text == null ? '' : text).trim()) return blank();
    var v = parseNumber(text), target = energy(n);
    if (v === null) return bad('Type a number, such as -0.242.');
    if (within(v, target, ENERGY_TOLERANCE)) return good();
    if (within(-v, target, ENERGY_TOLERANCE)) return bad('The size is right. Check the sign in Eqn 1.');
    if (wrongPower(v, target) || wrongPower(-v, target)) return bad('The digits are right but the decimal point is not. Keep the power of ten as 10⁻¹⁸ and move the point.');
    if (within(v, -RYDBERG / n, ENERGY_TOLERANCE)) return bad('Divide by n squared, not by n.');
    return bad('Not what Eqn 1 gives for n = ' + n + '. Work it again.');
  }

  // The jumps of Table 4, in the order of the table: down the first column of the handout, row by row.
  var JUMPS = [];
  (function () {
    for (var lo = 1; lo <= 5; lo++) for (var hi = 6; hi > lo; hi--) JUMPS.push({ hi: hi, lo: lo, key: hi + '-' + lo });
  })();

  // Table 4, top line of each pair: the energy change. `own` is what the student's own Table 3
  // gives for it (final minus initial), or null: an answer that follows from their own table counts.
  function checkDelta(hi, lo, text, own) {
    if (!String(text == null ? '' : text).trim()) return blank();
    var v = parseNumber(text), target = deltaE(hi, lo);
    if (v === null) return bad('Type a number, such as -0.303.');
    if (within(v, target, ENERGY_TOLERANCE) || (own !== null && own !== undefined && within(v, own, 0.006) && within(own, target, 0.04))) return good();
    if (within(-v, target, ENERGY_TOLERANCE)) return bad('The size is right, but not the sign. The change is the final energy minus the initial energy, and the electron ends on the lower level.');
    if (wrongPower(v, target) || wrongPower(-v, target)) return bad('The digits are right but the decimal point is not. Keep the power of ten as 10⁻¹⁸.');
    return bad('Not the change in energy from n = ' + hi + ' to n = ' + lo + '. Use Eqn 3, or subtract your two energies in Table 3.');
  }

  // Table 4, bottom line of each pair: the wavelength. `ownDelta` is the student's own accepted
  // energy change for this jump, or null.
  function checkWavelength(hi, lo, text, ownDelta) {
    if (!String(text == null ? '' : text).trim()) return blank();
    var v = parseNumber(text), target = wavelength(hi, lo);
    if (v === null) return bad('Type a number of nanometers, such as 480.');
    if (v < 0) return bad('A wavelength is never negative. Use the size of the energy change in Eqn 4.');
    if (within(v, target, WAVELENGTH_TOLERANCE)) return good();
    if (ownDelta !== null && ownDelta !== undefined && ownDelta !== 0 && within(v, HC_NM / Math.abs(ownDelta), 0.005)) return good();
    if (within(v * 1e9, target, WAVELENGTH_TOLERANCE)) return bad('That is the wavelength in meters. Change it to nanometers with Eqn 5.');
    for (var k = -4; k <= 4; k++) {
      if (k !== 0 && within(v * Math.pow(10, k), target, WAVELENGTH_TOLERANCE)) return bad('The digits are right but the decimal point is not. Check your powers of ten.');
    }
    return bad('Not the wavelength for this jump. Divide h times c by the size of the energy change, then change meters to nanometers.');
  }

  // ---- Matching a measured line to a jump ------------------------------------------------------------

  // The jump, among levels 1 to 10, whose calculated wavelength is nearest to a measured one.
  function jumpFor(nm) {
    var best = null, miss = Infinity;
    for (var lo = 1; lo < LEVELS; lo++) {
      for (var hi = lo + 1; hi <= LEVELS; hi++) {
        var d = Math.abs(wavelength(hi, lo) - nm);
        if (d < miss) { miss = d; best = { hi: hi, lo: lo }; }
      }
    }
    return best && miss <= nm * 0.015 ? best : null;
  }

  // Table 5: the jump a student gives for a measured wavelength.
  function checkJump(nm, hiText, loText) {
    var hiBlank = !String(hiText == null ? '' : hiText).trim(), loBlank = !String(loText == null ? '' : loText).trim();
    if (hiBlank || loBlank || nm === null) return blank();
    var hi = parseNumber(hiText), lo = parseNumber(loText);
    if (hi === null || lo === null || hi !== Math.round(hi) || lo !== Math.round(lo) || hi < 1 || lo < 1) return bad('Each level is a whole number, 1 or more.');
    if (hi === lo) return bad('The electron has to change level to give off light.');
    var right = jumpFor(nm);
    if (!right) return blank();
    if (hi === right.hi && lo === right.lo) return good();
    if (hi === right.lo && lo === right.hi) return bad('Those are the two levels, the wrong way round: the electron falls, so the higher level comes first.');
    if (hi < lo) return bad('The electron falls to give off light, so the higher level comes first.');
    if (hi > LEVELS) return bad('Keep to the ten levels of Table 3.');
    return bad('That jump does not give this wavelength. Compare it with Table 4, or work out other jumps from your energies in Table 3.');
  }

  // ---- Questions ---------------------------------------------------------------------------------------

  // Question 1: what the lines Balmer could measure have in common.
  function checkCommon(end, levelText) {
    if (!end || !String(levelText == null ? '' : levelText).trim()) return blank();
    var n = parseNumber(levelText);
    if (n === null) return bad('Give the level as a whole number.');
    if (end === 'end' && n === 2) return good();
    if (end === 'start' && n === 2) return bad('Level 2 is right. Look at which end of each jump it is.');
    return bad('Look again at the jumps you gave in Table 5 for the lines between 350 and 700 nm.');
  }

  // Question 2: the longest wavelength of the series that ends at level 2. `measured` is the
  // student's own accepted lines.
  function checkLongest(text, measured) {
    if (!String(text == null ? '' : text).trim()) return blank();
    var v = parseNumber(text), target = wavelength(3, 2);
    if (v === null) return bad('Type a number of nanometers.');
    if (Math.abs(v - target) <= 1.5) return good();
    var best = jumpFor(v);
    if (best && best.lo === 2) return bad('That line is in the series, but another of its lines has a longer wavelength.');
    if (best && (measured || []).some(function (m) { return Math.abs(m - v) <= 1.5; })) return bad('That is one of your lines, but its jump does not end where the Balmer lines end. Keep your answer to question 1 in mind.');
    return bad('Choose from the wavelengths you measured, keeping your answer to question 1 in mind.');
  }

  // Question 3: jumps from very high levels down to level 2.
  var LIMIT_LEVELS = [10, 100, 1000, 10000, 100000];
  var LIMIT = HC_NM / (RYDBERG / 4);         // where the wavelengths are heading (nm)

  function checkLimitDelta(hi, text) {
    if (!String(text == null ? '' : text).trim()) return blank();
    var v = parseNumber(text), target = deltaE(hi, 2);
    if (v === null) return bad('Type a number, such as -0.523.');
    if (within(v, target, 0.0025)) return good();
    if (within(-v, target, 0.0025)) return bad('The size is right, but not the sign: keep it the same way as in Table 4.');
    if (wrongPower(v, target) || wrongPower(-v, target)) return bad('The digits are right but the decimal point is not. Keep the power of ten as 10⁻¹⁸.');
    if (within(Math.abs(v), RYDBERG * (1 - 1 / (hi * hi)), 0.0025)) return bad('That is for a fall to level 1. Which level do the Balmer lines end on?');
    return bad('Not what Eqn 3 gives for a fall from n = ' + hi + '. Keep several digits: these numbers are close together.');
  }

  function checkLimitWavelength(hi, text, ownDelta) {
    if (!String(text == null ? '' : text).trim()) return blank();
    var v = parseNumber(text), target = wavelength(hi, 2);
    if (v === null) return bad('Type a number of nanometers.');
    if (within(v, target, 0.003)) return good();
    if (ownDelta !== null && ownDelta !== undefined && ownDelta !== 0 && within(v, HC_NM / Math.abs(ownDelta), 0.001)) return good();
    if (within(v * 1e9, target, 0.003)) return bad('That is the wavelength in meters. Change it to nanometers.');
    return bad('Not the wavelength for this jump. Use Eqn 4 and Eqn 5 with your energy change.');
  }

  var TRENDS = [
    { value: 'even', text: 'gets shorter by the same amount each time' },
    { value: 'limit', text: 'gets shorter by less and less, closing in on one value' },
    { value: 'longer', text: 'gets longer and longer' }
  ];
  function checkTrend(value) {
    if (!value) return blank();
    return value === 'limit' ? good() : bad('Look down your column of wavelengths in question 3: compare each step with the one before.');
  }
  function checkLimit(text) {
    if (!String(text == null ? '' : text).trim()) return blank();
    var v = parseNumber(text);
    if (v === null) return bad('Type a number of nanometers.');
    return Math.abs(v - LIMIT) <= 1.2 ? good() : bad('Look at where your wavelengths in question 3 stop changing.');
  }

  // ---- Measured lines ------------------------------------------------------------------------------------

  // What to say about a wavelength once the 3D lab has judged it.
  function lineMessage(verdict, slot) {
    switch (verdict) {
      case 'ok': return good();
      case 'near': return bad('Close. Read it again more carefully: the closer view of the spectroscope, or a narrower sweep of the detector.');
      case 'off': return bad('There is no line of ' + tubeName(slot) + ' at that wavelength. Check which tube is lit, and read it again.');
    }
    return blank();
  }

  // Before a measured wavelength goes to the 3D lab: is it a number that could be one at all?
  function checkMeasured(text) {
    if (!String(text == null ? '' : text).trim()) return blank();
    var v = parseNumber(text);
    if (v === null) return bad('Type a number of nanometers, such as 512.4.');
    if (v < DETECTOR_FROM || v > DETECTOR_TO) return bad('Neither the spectroscope nor the detector reaches that wavelength.');
    if (v >= EYE_FROM && v <= EYE_TO && !hasDecimal(text)) return bad('Read it to the nearest tenth of a nanometer: the spectroscope’s closer view, or a narrower sweep of the detector.');
    return null;      // fit to be judged
  }

  // Two measurements of the same line: `nm` against the ones entered before it.
  function sameLine(a, b) { return Math.abs(a - b) <= Math.max(0.7, a * 0.0009); }

  // The unknown's line and the same line in the tube it is said to match.
  function checkAgrees(text, unknownNm) {
    if (!String(text == null ? '' : text).trim()) return blank();
    var v = parseNumber(text);
    if (v === null) return bad('Type a number of nanometers, such as 512.4.');
    if (unknownNm === null || unknownNm === undefined) return blank();
    if (Math.abs(v - unknownNm) <= 0.4) return good();
    return bad('This is not at the same place as the unknown’s line beside it. Two tubes of the same gas give the same lines.');
  }

  function lookMessage(verdict) {
    if (verdict === 'ok') return good();
    if (verdict === 'off') return bad('Look again through the spectroscope, and slide along the whole scale.');
    return blank();
  }
  function countMessage(verdict) {
    switch (verdict) {
      case 'ok': return good();
      case 'few': return bad('There are more. Switch the hood light off, and slide along the whole scale, right to its violet end.');
      case 'many': return bad('Not that many. Count only the lines you can see through the spectroscope, with the hydrogen tube lit and the white lamp off.');
    }
    return blank();
  }

  // ---- The next step on the bench --------------------------------------------------------------------------

  // bench: what the 3D lab last reported. done: { lines: how many hydrogen lines are accepted }.
  function nextStep(bench, done) {
    var b = bench || { holder: -1, power: false, lamp: false, lights: true };
    if (b.holder < 0) return 'Choose a tube from the tray: click the tube, or its name in front of it.';
    if (!b.power) return 'The ' + TUBES[b.holder].name + ' tube is in the power supply. Switch the supply on.';
    var lit = b.holder === UNKNOWN ? 'The unknown tube is lit.' : TUBES[b.holder].name.charAt(0).toUpperCase() + TUBES[b.holder].name.slice(1) + ' is lit.';
    if (b.lights) return lit + ' Look at the screen behind the prism, and try the hood light off.';
    if (b.holder === HYDROGEN && done && done.lines < HYDROGEN_LINES) {
      return lit + ' Measure each line you can see with the spectroscope, and find the rest with the detector.';
    }
    return lit + ' Switch the supply off before you change tubes.';
  }

  return {
    TUBES: TUBES, HYDROGEN: HYDROGEN, UNKNOWN: UNKNOWN, REFERENCES: REFERENCES,
    HYDROGEN_LINES: HYDROGEN_LINES, UNKNOWN_LINES: UNKNOWN_LINES, GLOWS: GLOWS, LOOKS: LOOKS, TRENDS: TRENDS,
    SCOPE_FROM: SCOPE_FROM, SCOPE_TO: SCOPE_TO, EYE_FROM: EYE_FROM, EYE_TO: EYE_TO, DETECTOR_FROM: DETECTOR_FROM, DETECTOR_TO: DETECTOR_TO,
    tubeName: tubeName,
    codeFromNumber: codeFromNumber, numberFromCode: numberFromCode, normalizeCode: normalizeCode, isCode: isCode, randomCode: randomCode,
    parseNumber: parseNumber, hasDecimal: hasDecimal,
    LEVELS: LEVELS, GIVEN_LEVEL: GIVEN_LEVEL, JUMPS: JUMPS, LIMIT_LEVELS: LIMIT_LEVELS, LIMIT: LIMIT, HC_NM: HC_NM,
    energy: energy, deltaE: deltaE, wavelength: wavelength,
    checkEnergy: checkEnergy, checkDelta: checkDelta, checkWavelength: checkWavelength,
    jumpFor: jumpFor, checkJump: checkJump,
    checkCommon: checkCommon, checkLongest: checkLongest, checkLimitDelta: checkLimitDelta, checkLimitWavelength: checkLimitWavelength,
    checkTrend: checkTrend, checkLimit: checkLimit,
    lineMessage: lineMessage, checkMeasured: checkMeasured, sameLine: sameLine, checkAgrees: checkAgrees,
    lookMessage: lookMessage, countMessage: countMessage,
    nextStep: nextStep
  };
});
