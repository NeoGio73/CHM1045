// Everything an instructor is likely to edit lives in this file:
// the completion code, the molecules, the questions and the narrator's lines.

export const CONFIG = {
  chamber: '06',
  title: 'Six electron domains',
  // Students type this into a Canvas quiz to prove they finished. Change it each term.
  completionCode: 'OCTAHEDRAL-90',
  maxDomains: 6,
};

export const ELEMENTS = {
  S: { name: 'sulfur', valence: 6, color: '#e9c72f' },
  Br: { name: 'bromine', valence: 7, color: '#c4513a' },
  Xe: { name: 'xenon', valence: 8, color: '#45b5d6' },
  F: { name: 'fluorine', valence: 7, color: '#9be06a' },
};

export const SHAPE_OPTIONS = [
  'Octahedral', 'Square pyramidal', 'Square planar', 'Seesaw', 'T-shaped', 'Trigonal bipyramidal',
];
export const ANGLE_OPTIONS = ['Exactly 90°', 'Slightly less than 90°', '109.5°', '120°'];

export const SUBJECTS = [
  {
    formula: 'SF₆', html: 'SF<sub>6</sub>', name: 'sulfur hexafluoride',
    central: 'S', terminal: 'F', bonds: 6, lone: 0,
    shape: 'Octahedral', angle: 'Exactly 90°',
    count: 'S brings 6 valence electrons and six F bring 42, so 48 in total. Six bonds use 12. Three lone pairs on each F use 36. Nothing is left over, so sulfur has no lone pairs.',
    shapeWhy: 'Six bonding pairs and no lone pairs: the atoms sit at all six corners of an octahedron.',
    shapeHints: {},
    angleWhy: 'All six domains are identical bonding pairs, so every neighbouring F–S–F angle is exactly 90°.',
    angleHints: {
      'Slightly less than 90°': 'Angles only shrink when a lone pair pushes on the bonds. SF₆ has no lone pairs on sulfur.',
    },
    facts: [['F–S–F angle', '90°'], ['Polarity', 'Nonpolar: the six bond dipoles cancel']],
  },
  {
    formula: 'BrF₅', html: 'BrF<sub>5</sub>', name: 'bromine pentafluoride',
    central: 'Br', terminal: 'F', bonds: 5, lone: 1,
    shape: 'Square pyramidal', angle: 'Slightly less than 90°',
    count: 'Br brings 7 valence electrons and five F bring 35, so 42 in total. Five bonds use 10. Three lone pairs on each F use 30. That leaves 2 electrons: one lone pair on bromine.',
    shapeWhy: 'Six domains make an octahedron, but one corner holds a lone pair. The five atoms that remain form a square-based pyramid.',
    shapeHints: {
      Octahedral: 'Octahedral describes all six electron domains. The molecular shape is named from the atoms only.',
    },
    angleWhy: 'A lone pair pushes harder than a bonding pair, so the four base fluorines are squeezed up toward the top one. The measured angle is about 85°.',
    angleHints: {
      'Exactly 90°': 'It would be 90° if all six domains pushed equally. A lone pair pushes harder than a bonding pair.',
    },
    facts: [['F–Br–F angle', 'About 85°'], ['Polarity', 'Polar: the lone pair makes the molecule lopsided']],
  },
  {
    formula: 'XeF₄', html: 'XeF<sub>4</sub>', name: 'xenon tetrafluoride',
    central: 'Xe', terminal: 'F', bonds: 4, lone: 2,
    shape: 'Square planar', angle: 'Exactly 90°',
    count: 'Xe brings 8 valence electrons and four F bring 28, so 36 in total. Four bonds use 8. Three lone pairs on each F use 24. That leaves 4 electrons: two lone pairs on xenon.',
    shapeWhy: 'The two lone pairs take opposite corners of the octahedron, 180° apart. The four fluorines are left in a flat square around xenon.',
    shapeHints: {
      Octahedral: 'Octahedral describes all six electron domains. The molecular shape is named from the atoms only.',
      Seesaw: 'Seesaw comes from five domains with one lone pair. Count the domains on xenon again.',
    },
    angleWhy: 'Each lone pair does push on the bonds, but one pushes from above and the other from below. The pushes cancel and the F–Xe–F angle stays at 90°.',
    angleHints: {
      'Slightly less than 90°': 'One lone pair would squeeze the bonds. Here there are two, on opposite sides of the square. What happens to their pushes?',
    },
    facts: [['F–Xe–F angle', '90°'], ['Polarity', 'Nonpolar: the bond dipoles cancel, and so do the lone pairs']],
  },
];

export const LINES = {
  intro: 'Welcome to Test Chamber 06. Each of today’s subjects has six electron domains around its central atom. Electron domains repel one another. This is not personal. It is physics.',
  build: (s, i) => `Subject ${i + 1}: ${s.name}. Attach its electron domains to the central atom. Blue for a bonding pair. Orange for a lone pair.`,
  firstBond: 'A bonding pair, with a fluorine atom attached at no extra charge.',
  firstLone: 'A lone pair. It takes up more room than a bond and it will not apologise.',
  shuffle: 'Notice how the domains shuffle to get as far from each other as they can.',
  full: 'Six domains. This central atom is now at capacity.',
  overflow: 'This chamber is rated for six electron domains. The seventh has been declined.',
  empty: 'There is nothing to remove. I admire the optimism.',
  fizzle: 'Domains removed. The central atom is alone again, which is how it started.',
  wrongBuild: (s) => `That is not ${s.formula}. The turrets have noticed.`,
  rightBuild: 'Correct. The domains have settled as far apart as possible, which is more cooperation than I expected.',
  rightBuildTrans: 'Correct. Look at where the two lone pairs went: opposite sides, as far from each other as they can get.',
  wrongAnswer: 'Incorrect. The turrets are watching you try again.',
  rightShape: 'Correct. The shape is named for where the atoms are. Lone pairs shape the molecule without appearing in its name.',
  rightAngle: 'Correct. One turret has been deactivated. It wants you to know it does not blame you.',
  next: 'The next subject is ready whenever you are.',
  done: 'Testing is complete. All three turrets are asleep. You may collect your completion code.',
};
