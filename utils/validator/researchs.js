export default {
  id: 1,
  name: 'Unnamed Research',
  description: '',
  icon: 'default.png',
  maxLevel: 1,
  requires: [],
  cost: (level) => 100,
  duration: (level) => 60,
  dependencies: ``,
  apply: (user, research, dep) => {},
  _emptyAllowed: ['dependencies', 'require', 'icon'],
};
