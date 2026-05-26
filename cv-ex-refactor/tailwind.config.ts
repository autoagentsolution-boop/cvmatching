import type { Config } from 'tailwindcss';

/**
 * Tailwind v4: theme tokens live in src/app/globals.css @theme block.
 * This file exists solely to declare content paths for class scanning.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
};

export default config;
