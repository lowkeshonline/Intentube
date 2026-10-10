import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Intentube',
    description: 'Ask why you are on YouTube, dim distractions.',
    permissions: ['storage'],
    host_permissions: ['https://api.typesafe.ai/*'],
  },
});
