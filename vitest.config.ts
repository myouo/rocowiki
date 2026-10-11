import {defineConfig} from 'vitest/config';
export default defineConfig({server:{hmr:false},test:{include:['tests/**/*.test.ts'],pool:'threads',maxWorkers:2,minWorkers:1}});
