// Where each chamber sits inside the map (metres, y up).
//
//   center    where the molecule floats
//   min, max  the box the camera is kept inside, so it never ends up behind a wall
//   camera    where the camera starts
//   turrets   optional [x, z] floor spots; without it they line up behind the molecule
//   narrator  optional [x, y, z] perch for the supervising core; without it it hovers nearby
//   lamp      optional brightness of the light over the molecule (default 14)

export const ROOMS = {
  // plain white room in the south-west corner
  southwest: {
    center: [-2.5, 3.6, 0.0],
    min: [-8.1, 1.6, -4.4],
    max: [4.4, 5.7, 4.4],
    camera: [-0.9, 4.1, -2.9],
  },
  // white room with the receptacle and stairs
  west: {
    center: [-9.5, 3.0, -18.0],
    min: [-13.5, 1.0, -22.3],
    max: [-4.9, 6.5, -15.7],
    camera: [-6.0, 3.5, -17.2],
    turrets: [[-12.6, -16.4], [-12.9, -18.1], [-12.6, -19.6]], // open floor in front of the steps
  },
  // white room with the floor button and observation windows
  northwest: {
    center: [-6.0, 3.0, -26.9],
    min: [-10.5, 1.0, -30.2],
    max: [-1.9, 6.5, -23.6],
    camera: [-6.0, 3.5, -23.6],
  },
  // tall dark atrium: the molecule floats over the square pad where the glass walkways cross
  atrium: {
    center: [29.25, 3.9, 2.25],
    min: [24.5, 1.7, -1.6],
    max: [34.0, 6.8, 6.2],
    camera: [31.9, 4.5, 4.9],
    turrets: [[31.0, 0.5], [29.2, 0.4], [27.4, 0.5], [27.3, 2.4]], // along the far edges of the pad
    lamp: 30,
  },
  // white chamber with the pedestal button
  north: {
    center: [-4.6, 3.0, -34.7],
    min: [-8.2, 0.95, -38.0],
    max: [-0.95, 5.2, -31.3],
    camera: [-3.0, 3.5, -31.5],
    turrets: [[-6.7, -37.3], [-4.6, -37.6], [-2.5, -37.3], [-1.3, -36.0]],
    narrator: [-8.95, 2.85, -34.75], // on top of the pedestal button
  },
};
