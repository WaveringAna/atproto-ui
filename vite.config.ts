import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'unplugin-dts/vite'
import { resolve } from 'path';
import type { Plugin } from 'vite';

// Plugin to inject CSS import as a side effect in the main entry
function injectCssImport(): Plugin {
    return {
        name: 'inject-css-import',
        generateBundle(_, bundle) {
            const indexFile = bundle['index.js'];
            if (indexFile && indexFile.type === 'chunk') {
                // Inject the CSS import at the top of the file
                indexFile.code = `import './styles.css';\n${indexFile.code}`;
            }
        }
    };
}

const buildDemo = process.env.BUILD_TARGET === 'demo';

// https://vite.dev/config/
export default defineConfig({
    plugins: buildDemo
        ? [react()]
        : [react(), dts({ tsconfigPath: './tsconfig.lib.json' }), injectCssImport()],

    // Demo app needs to resolve from src
    root: buildDemo ? '.' : undefined,

    build: buildDemo ? {
        // Demo app build configuration
        outDir: 'demo',
        rollupOptions: {
            input: resolve(__dirname, 'index.html')
        },
        sourcemap: false
    } : {
        // Library build configuration
        lib: {
            entry: resolve(__dirname, 'lib/index.ts'),
            cssFileName: resolve(__dirname, 'lib/styles.css'),
            name: 'atproto-ui',
            formats: ['es'],
            fileName: 'atproto-ui'
        },
        cssCodeSplit: false,
        outDir: 'lib-dist',
        rollupOptions: {
            // Externalize dependencies that shouldn't be bundled
            external: [
                'react',
                'react-dom',
                'react/jsx-runtime',
                '@atcute/atproto',
                '@atcute/bluesky',
                '@atcute/client',
                '@atcute/identity-resolver',
                '@atcute/tangled'
            ],
            output: {
                preserveModules: true,
                preserveModulesRoot: 'lib',
                entryFileNames: '[name].js'
            }
        },
    }
});
