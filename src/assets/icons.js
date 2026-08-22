// Central map of the app's own rank badges and module icons, so the console
// shows learners and lessons with the same visuals they see in the app rather
// than plain text. SVGs are copied from Documents/Rank Badges and
// Documents/Module-icons (the same sources the Android drawables came from).

import rankNovice from './rank/rank-novice.svg'
import rankSkilled from './rank/rank-skilled.svg'
import rankExpert from './rank/rank-expert.svg'
import rankMaster from './rank/rank-master.svg'

import mAlphabet from './modules/alphabet.svg'
import mNumbers from './modules/numbers.svg'
import mGreetings from './modules/greetings.svg'
import mSchool from './modules/school.svg'
import mEmergency from './modules/emergency.svg'
import mDailyNeeds from './modules/dailyneeds.svg'
import mSocial from './modules/social.svg'

// RankTier.title (mobile) → badge. Falls back to the novice badge.
const RANK_ICON = {
  'Novice Signer': rankNovice,
  'Skilled Signer': rankSkilled,
  'Expert Signer': rankExpert,
  'Master Signer': rankMaster,
}

export function rankIcon(title) {
  return RANK_ICON[title] || rankNovice
}

// category id (FslSignData) → module illustration.
const MODULE_ICON = {
  alphabet: mAlphabet,
  numbers: mNumbers,
  greetings: mGreetings,
  school: mSchool,
  emergency: mEmergency,
  dailyneeds: mDailyNeeds,
  social: mSocial,
}

export function moduleIcon(categoryId) {
  return MODULE_ICON[categoryId] || null
}
