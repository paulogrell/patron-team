export default {
  paths: ['bdd/features/**/*.feature'],
  import: ['bdd/support/**/*.js', 'bdd/steps/**/*.js'],
  format: ['progress', 'html:bdd/reports/cucumber-report.html'],
  tags: 'not @skip',
  publishQuiet: true,
  retry: 0,
  parallel: 1,
  failFast: false,
};
