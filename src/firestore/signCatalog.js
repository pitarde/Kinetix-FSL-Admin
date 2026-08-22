// A read-only mirror of the mobile app's built-in FSL catalog
// (Kinetix-FSL/app/.../modules/model/SignCategory.kt → FslSignData).
//
// The app compiles its lessons in; there is no Firestore "lessons" collection
// to read. This mirror gives the admin console human labels for the category
// and sign ids that appear in the analytics data, and is the base list the
// Content Management page layers enable/disable overrides on top of.
//
// If a sign/category is ever added on the mobile side, add it here too.

export const CATEGORIES = [
  {
    id: 'alphabet',
    title: 'Filipino Alphabet',
    signs: [
      ['alpha_a', 'A'], ['alpha_b', 'B'], ['alpha_c', 'C'], ['alpha_d', 'D'],
      ['alpha_e', 'E'], ['alpha_f', 'F'], ['alpha_g', 'G'], ['alpha_h', 'H'],
      ['alpha_i', 'I'], ['alpha_j', 'J'], ['alpha_k', 'K'], ['alpha_l', 'L'],
      ['alpha_m', 'M'], ['alpha_n', 'N'], ['alpha_o', 'O'], ['alpha_p', 'P'],
      ['alpha_q', 'Q'], ['alpha_r', 'R'], ['alpha_s', 'S'], ['alpha_t', 'T'],
      ['alpha_u', 'U'], ['alpha_v', 'V'], ['alpha_w', 'W'], ['alpha_x', 'X'],
      ['alpha_y', 'Y'], ['alpha_z', 'Z'], ['alpha_enye', 'Ñ'], ['alpha_ng', 'NG'],
    ],
  },
  {
    id: 'numbers',
    title: 'Numbers 0-9',
    signs: [
      ['num_0', '0'], ['num_1', '1'], ['num_2', '2'], ['num_3', '3'],
      ['num_4', '4'], ['num_5', '5'], ['num_6', '6'], ['num_7', '7'],
      ['num_8', '8'], ['num_9', '9'],
    ],
  },
  {
    id: 'greetings',
    title: 'Greetings',
    signs: [
      ['greet_kamusta', 'Kamusta'], ['greet_salamat', 'Salamat'],
      ['greet_walang_anuman', 'Walang Anuman'], ['greet_ayos_lang_ako', 'Ayos lang ako'],
    ],
  },
  {
    id: 'school',
    title: 'School',
    signs: [
      ['school_pagaaral', 'Pag-aaral'], ['school_basahin', 'Basahin'],
      ['school_paaralan', 'Paaralan'], ['school_magaaral', 'Mag-aaral'],
    ],
  },
  {
    id: 'emergency',
    title: 'Emergency',
    signs: [
      ['emer_danger', 'Danger'], ['emer_stop', 'Stop'],
      ['emer_calm_down', 'Calm down'], ['emer_accident', 'Accident'],
    ],
  },
  {
    id: 'dailyneeds',
    title: 'Daily Needs',
    signs: [
      ['dn_eat', 'Eat'], ['dn_drink', 'Drink'],
      ['dn_sleep', 'Sleep'], ['dn_hungry', 'Hungry'],
    ],
  },
  {
    id: 'social',
    title: 'Social Interaction',
    signs: [
      ['soc_oo', 'Oo'], ['soc_hindi', 'Hindi'],
      ['soc_kaibigan', 'Kaibigan'], ['soc_patawad', 'Patawad'],
    ],
  },
]

/** categoryId → title */
export const CATEGORY_TITLE = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.title]))

/** signId → display name (e.g. "alpha_a" → "A") */
export const SIGN_NAME = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.signs).map(([id, name]) => [id, name]),
)

/** signId → its category id */
export const SIGN_CATEGORY = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.signs.map(([id]) => [id, c.id])),
)

export const TOTAL_SIGNS = CATEGORIES.reduce((n, c) => n + c.signs.length, 0)

export function categoryTitle(id) {
  return CATEGORY_TITLE[id] || id
}
