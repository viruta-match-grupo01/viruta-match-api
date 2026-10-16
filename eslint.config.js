import js from '@eslint/js';
import globals from 'globals';
export default [js.configs.recommended, {files:['**/*.js','**/*.jsx'],languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:{...globals.node,...globals.browser},parserOptions:{ecmaFeatures:{jsx:true}}},rules:{'no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^[A-Z_]'}]}}, {ignores:['node_modules/**','client/dist/**']}];
