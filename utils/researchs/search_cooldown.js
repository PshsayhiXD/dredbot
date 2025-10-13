export default {
  name: "Search Cooldown",
  description: "Reduces the cooldown of search by 5% per level.",
  icon: "icon/search_cooldown.png",
  id: 3,
  maxLevel: 5,
  require: ["skill_rerolling"],
  cost: (level) => 1000 * Math.pow(1.2, level - 1), // 1000, 1200, 1440, 1728, 1974
  duration: (level) => 5 * 60 * 1000 * (level + 1), // 5 minutes per level
  dependencies: ``,
  apply: async (user, research, dep) => {},
  _emptyAllowed: ['dependencies', 'require', 'icon'],
};