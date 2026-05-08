import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import { federation } from '@module-federation/vite';
import { moduleFederationShared } from '@iobroker/adapter-react-v5/modulefederation.admin.config';
import { readFileSync } from 'node:fs';

export default {
    plugins: [
        federation({
            manifest: true,
            name: 'EmsAdminSet',
            filename: 'customComponents.js',
            exposes: {
                './Components': './src/Components.tsx',
            },
            remotes: {},
            shared: moduleFederationShared(JSON.parse(readFileSync('./package.json').toString())),
        }),
        react(),
        viteTsconfigPaths(),
        commonjs(),
    ],
    server: {
        port: 4173,
    },
    base: './',
    build: {
        target: 'chrome89',
        outDir: './build',
    },
};
