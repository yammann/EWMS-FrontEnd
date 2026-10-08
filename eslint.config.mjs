// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

/**
 * ESLint للمشروع (إعادة الهيكلة 2026-10-08). حدود المعمارية:
 *  - core/ لا يعتمد على features/ ولا shared/ui.
 *  - shared/ لا يعتمد على features/.
 *  - الميزة لا تستورد ميزة أخرى إلا عبر واجهتها العامة (@features/<ميزة>) وليس ملفاً داخلها.
 *  - لا استيراد نسبي يخرج من مجلد أكثر من مستوى (استعمل @core / @shared / @features).
 */
export default tseslint.config(
  { ignores: ['dist/**', '.angular/**', 'node_modules/**', 'public/**', 'scripts/**', 'e2e/.auth/**', 'playwright-report/**', 'test-results/**'] },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    languageOptions: { parserOptions: { project: false } },
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      '@angular-eslint/prefer-standalone': 'off',                        // كل المكوّنات standalone (الافتراضي في v22)
      '@angular-eslint/prefer-inject': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }],
      '@angular-eslint/no-output-native': 'warn',                        // close/cancel: يُعاد تسميتها في المرحلة 5
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
      'no-restricted-imports': ['warn', {
        patterns: [
          { group: ['../../*', '../../../*'], message: 'استعمل المسارات المستعارة @core / @shared / @features بدل الصعود أكثر من مستوى.' }
        ]
      }]
    }
  },
  // ───────── حدود الطبقات ─────────
  {
    files: ['src/app/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [
          { group: ['@features/*', '@shared/ui/*'], message: 'core لا يعتمد على features ولا على مكوّنات shared/ui.' },
          { group: ['../../*'], message: 'استعمل @core / @shared.' }
        ]
      }]
    }
  },
  {
    files: ['src/app/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [
          { group: ['@features/*'], message: 'shared لا يعتمد على features.' },
          { group: ['../../*'], message: 'استعمل @core / @shared.' }
        ]
      }]
    }
  },
  {
    files: ['src/app/features/**/*.ts'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [
          { group: ['@features/*/*'], message: 'استورد من الواجهة العامة للميزة (@features/<ميزة>) لا من ملف داخلها.' },
          { group: ['../../*', '../../../*'], message: 'استعمل @core / @shared / @features بدل الصعود أكثر من مستوى.' }
        ]
      }]
    }
  },
  {
    files: ['src/app/**/*.spec.ts', 'e2e/**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-restricted-imports': 'off' }
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }],
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/label-has-associated-control': 'off'
    }
  }
);
