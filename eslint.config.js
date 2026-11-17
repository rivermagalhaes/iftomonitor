import tseslint from 'typescript-eslint';
export default tseslint.config(...tseslint.configs.recommended, { ignores: ['dist/**','android/**','node_modules/**'] });
