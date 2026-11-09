import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Layering: routes -> controllers -> services -> (models, stores, repositories, extension)
// views and middlewares are leaves. Nothing imports upward.
const layer = (name, forbidden) => ({
  files: [`src/${name}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: forbidden.map((group) => ({
          group: [`**/${group}/*`, `**/${group}`],
          message: `src/${name} must not import from src/${group} (see layering rules in README).`,
        })),
      },
    ],
  },
});

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // Tests read HTTP bodies (untyped `any` from supertest) and use fixtures; the strict unsafe-any
    // and non-null rules add noise without catching bugs there.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  layer('routes', ['services', 'models', 'stores', 'repositories', 'extension', 'lib', 'views', 'schemas']),
  layer('controllers', ['routes', 'stores', 'repositories', 'extension', 'lib']),
  layer('services', ['routes', 'controllers', 'views']),
  layer('views', ['routes', 'controllers', 'services', 'stores', 'repositories', 'extension', 'lib']),
  layer('models', ['routes', 'controllers', 'services', 'views', 'stores', 'repositories', 'extension', 'middlewares']),
  layer('stores', ['routes', 'controllers', 'services', 'views', 'extension', 'middlewares']),
  layer('repositories', ['routes', 'controllers', 'services', 'views', 'extension', 'middlewares']),
  layer('extension', ['routes', 'controllers', 'services', 'views', 'middlewares', 'stores', 'repositories']),
  layer('middlewares', ['routes', 'controllers', 'services', 'extension']),
  prettier,
);
