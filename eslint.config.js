const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

const nodeGlobals = {
    __dirname: 'readonly',
    __filename: 'readonly',
    Buffer: 'readonly',
    clearTimeout: 'readonly',
    console: 'readonly',
    module: 'readonly',
    process: 'readonly',
    require: 'readonly',
    setTimeout: 'readonly',
};

module.exports = tseslint.config(
    {
        ignores: [
            '.eslintrc.js',
            'bin/',
            'dist/',
            'node_modules/',
            'out/',
            'temp/',
        ],
    },
    {
        files: ['*.js', 'scripts/**/*.js', 'tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: nodeGlobals,
            sourceType: 'commonjs',
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: nodeGlobals,
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
            'no-control-regex': 'off',
            'no-constant-condition': ['error', { checkLoops: false }],
            'require-yield': 'off',
            'quotes': ['error', 'single'],
            'semi': ['error', 'always'],
            'indent': ['error', 4, { SwitchCase: 1, FunctionDeclaration: { parameters: 'first' } }],
            'comma-dangle': ['error', 'always-multiline'],
            'eol-last': ['error', 'always'],
            'no-trailing-spaces': 'error',
            'object-curly-spacing': ['error', 'always'],
            'space-infix-ops': 'error',
            'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
            'no-cond-assign': 'error',
            'preserve-caught-error': 'off',
            'no-async-promise-executor': 'off',
            'no-inner-declarations': 'off',
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/no-var-requires': 'off',
        },
    },
    {
        files: ['*.js', 'scripts/**/*.js', 'tests/**/*.js'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    }
);
