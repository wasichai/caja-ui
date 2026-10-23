// conventional commits, checked on every pull request (commits.yml) and by the commit-msg hook.
// release-please reads them to pick the next version.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 120],
    'subject-case': [0]
  }
}
