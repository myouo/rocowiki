module.exports = {
  name: 'explicit-workspace-test-context',
  setup(build) {
    build.onResolve({filter:/^@docusaurus\/useDocusaurusContext$/},args=>({path:args.path,namespace:'workspace-context'}));
    build.onLoad({filter:/.*/,namespace:'workspace-context'},()=>({loader:'js',contents:`
      export default function useDocusaurusContext(){return {siteConfig:{
        themeConfig:globalThis.__wikiThemeConfig || {navbar:{hideOnScroll:false}},
        customFields:{workspaceMode:globalThis.__wikiWorkspaceMode || 'demo',workspaceModeExplicit:true}
      }}};
    `}));
  },
};
