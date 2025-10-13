export default {
  name: "Search Quality",
  description: "Improves search loot quality by 5% per level.",
  icon: "icon/search_quality.png",
  id: 4,
  maxLevel: 5,
  require: ["skill_rerolling"],
  cost: (level) => 1200 * Math.pow(1.85, level - 1), // 1200, 2220, 4104, 7627, 14170
  duration: (level) => 5 * 60 * 1000 * (level + 1), // 6 minutes per level
  dependencies: ``,
  apply: async (user, research, dep) => {},
  _emptyAllowed: ['dependencies', 'require', 'icon'],
};