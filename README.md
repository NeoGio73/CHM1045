# CHM 1045: General Chemistry I

Interactive study guides and practice games for a college-level General Chemistry I course. Everything runs in a web browser, with nothing to install and no account to create.

**Students:** these activities are linked from the course in Canvas, and that is the best place to open them, because Canvas shows where each one fits in the week. The list below is here if you want to come back and practice.

## Activities

Listed in roughly the order the course covers them.

| Topic | Activity | Type |
| --- | --- | --- |
| Naming compounds and writing formulas | [Names & Formulas Lab](https://neogio73.github.io/CHM1045/names-formulas-lab.html) | Guided activity |
| Naming compounds and writing formulas | [Hoth Run](https://neogio73.github.io/CHM1045/hoth-run.html) | Game |
| Moles, molar mass, and Avogadro's number | [Moles and Molar Mass Study Guide](https://neogio73.github.io/CHM1045/mole-and-molar-mass-study-guide.html) | Study guide |
| Stoichiometry | [Stoichiometry Study Guide](https://neogio73.github.io/CHM1045/stoichiometry-study-guide.html) | Study guide |
| Solutions and titrations | [Solutions and Titrations Study Guide](https://neogio73.github.io/CHM1045/solution-stoichiometry-study-guide.html) | Study guide |
| Solutions and gases | [Solutions and Gases Study Guide](https://neogio73.github.io/CHM1045/solutions-and-gases-study-guide.html) | Study guide |
| Calorimetry and Hess's law | [Calorimetry and Hess's Law Study Guide](https://neogio73.github.io/CHM1045/calorimetry-and-hess-law-study-guide.html) | Study guide |
| Molecular shape (VSEPR) | [VSEPR Test Chambers](https://neogio73.github.io/CHM1045/vsepr-chamber-06/?chamber=menu) | Game |

## Study guides

Each guide opens with a roadmap of the topic, then walks through its sections in order. The numbers in every problem change each time, so a section can be repeated as often as you like. Nothing in the guides is graded or recorded.

| Guide | Sections |
| --- | --- |
| Moles and Molar Mass | Molar mass · Moles and particles · Moles and mass · Mass and particles · Atoms in a compound · Mixed practice |
| Stoichiometry | Mole to mole · Mass to mass · Density · Limiting reactant · Percent yield · Putting it together |
| Solutions and Titrations | Molarity · Dilution · Solution stoichiometry · Mixing two solutions · Titration calculations · Run a titration |
| Solutions and Gases | Molarity · Dilution · Solution stoichiometry · Mixing two solutions · Ideal gas law · Gas stoichiometry · Solutions and gases · Putting it together |
| Calorimetry and Hess's Law | Heat and temperature · Heat exchange · Coffee-cup calorimetry · Thermochemical equations · Hess's law · Run an experiment |

## Names & Formulas Lab

A three-part activity for chemical nomenclature: explore a compound and read its name step by step, balance the charges of its ions, then try the challenges. A quick reference at the end lists the common ions, the prefixes, and the acid naming patterns used in the lab.

## Hoth Run

A nomenclature flight trainer. Pilot a snowspeeder through the gate that shows the right answer.

| Sector | Topic |
| --- | --- |
| 1. Probe Recon | Ions and charges |
| 2. Ice Field | Binary ionic compounds |
| 3. Polyatomic Ridge | Compounds with polyatomic ions |
| 4. Transition Trench | Metals with Roman numerals |
| 5. Nonmetal Pass | Molecular compounds |
| 6. Generator Flats | Acids and hydrates |
| 7. The Walker (boss) | Mixed review, with typed answers |

- **Steer** with the arrow keys or <kbd>W</kbd> and <kbd>S</kbd>, or press <kbd>1</kbd> to <kbd>4</kbd> to pick a gate. <kbd>Enter</kbd> or <kbd>Space</kbd> flies through right away. On a touch screen, tap an answer, then tap it again.
- **Timed or not:** in timed mode the gate comes to you. With the timer off, the speeder waits until you choose.
- **Wrong answers** cost a shield and show why the answer was wrong. Each sector ends with a report of what you missed.
- <kbd>P</kbd> pauses and <kbd>M</kbd> mutes.

Hoth Run is practice only. Your best score for each sector is kept in your own browser and is not sent anywhere.

## VSEPR Test Chambers

A 3D game for molecular geometry. In each chamber you build molecules one electron domain at a time, then name the molecular shape and choose the bond angle. Blue adds a bond with its atom and orange adds a lone pair. Drag to look at the molecule from any side.

| Chamber | Electron domains | Molecules |
| --- | --- | --- |
| [02](https://neogio73.github.io/CHM1045/vsepr-chamber-06/?chamber=2) | Two | BeCl₂, CO₂, HCN |
| [03](https://neogio73.github.io/CHM1045/vsepr-chamber-06/?chamber=3) | Three | BF₃, SO₃, SO₂ |
| [04](https://neogio73.github.io/CHM1045/vsepr-chamber-06/?chamber=4) | Four | CH₄, NH₃, H₂O |
| [05](https://neogio73.github.io/CHM1045/vsepr-chamber-06/?chamber=5) | Five | PCl₅, SF₄, ClF₃, XeF₂ |
| [06](https://neogio73.github.io/CHM1045/vsepr-chamber-06/?chamber=6) | Six | SF₆, BrF₅, XeF₄ |

Finishing a chamber shows a completion code. Enter that code in the Canvas quiz for the chamber to get credit. The game itself does not record anything, although your browser remembers which chambers you have finished so the menu can tick them off.

The chambers need an internet connection and a browser with WebGL, which covers current versions of Chrome, Edge, Firefox, and Safari.

## For instructors

### How it is hosted

The repository is published with GitHub Pages from the `main` branch, so every file is served at `https://neogio73.github.io/CHM1045/` followed by its path. A change merged into `main` goes live a minute or two later.

Canvas links point at these exact addresses. Renaming or moving a file breaks its link in Canvas, which is also why the `vsepr-chamber-06` folder keeps its name even though it now holds chambers 02 to 06.

### Editing the activities

- **Study guides, Names & Formulas Lab, and Hoth Run** are each a single HTML file with the styles, script, and images inside it. They load nothing from other sites.
- **VSEPR Test Chambers** keeps the content an instructor is likely to change in [`vsepr-chamber-06/js/content.js`](vsepr-chamber-06/js/content.js): the chambers, molecules, questions, and narrator lines. Adding `?chamber=2` through `?chamber=6` to the address opens one chamber directly, and `?chamber=menu` opens the list. With nothing added, chamber 06 opens.

### Running a copy on your own computer

Download or clone the repository. The study guides, the lab, and Hoth Run open straight from the file with a double-click.

The VSEPR chambers have to be served by a web server, because browsers will not load their scripts and 3D models from a file on disk. From the repository folder, run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/vsepr-chamber-06/`.

### What is in the repository

```text
CHM1045/
├── names-formulas-lab.html
├── hoth-run.html
├── mole-and-molar-mass-study-guide.html
├── stoichiometry-study-guide.html
├── solution-stoichiometry-study-guide.html      Solutions and Titrations
├── solutions-and-gases-study-guide.html
├── calorimetry-and-hess-law-study-guide.html
└── vsepr-chamber-06/
    ├── index.html
    ├── js/
    │   ├── content.js    chambers, molecules, questions, narrator lines
    │   ├── rooms.js      where each chamber sits in the map
    │   ├── vsepr.js      geometry of the electron domains
    │   ├── scene.js      3D scene
    │   └── main.js       game flow
    └── assets/           3D models (.glb)
```

## Using these materials

You are welcome to use these activities in your own course and to adapt them for teaching. You can link to the pages above or host your own copy.

This covers the chemistry content and the code written for the course. It does not extend to the Star Wars and Portal names, characters, designs, and 3D models, which belong to their owners.

## Credits

- The Names & Formulas Lab uses [OpenStax Chemistry 2e, section 2.7](https://openstax.org/books/chemistry-2e/pages/2-7-chemical-nomenclature) as its reference for naming conventions.
- VSEPR Test Chambers is drawn with [three.js](https://threejs.org/).
- Hoth Run is an unofficial fan-made game for classroom use. Star Wars names and designs belong to Lucasfilm Ltd.
- VSEPR Test Chambers is an unofficial fan-made game for classroom use. Portal names, characters, and designs belong to Valve Corporation.
