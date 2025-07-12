export const getLanguageFromExtension = (ext: string): string => {
  const map: Record<string, string> = {
    // JavaScript/TypeScript family
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',

    // Web technologies
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',

    // Data formats
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    xml: 'xml',

    // Configuration files
    ini: 'ini',
    env: 'plaintext',
    cfg: 'plaintext',
    conf: 'plaintext',
    config: 'plaintext',
    properties: 'properties',

    // Documentation & text
    md: 'markdown',
    markdown: 'markdown',
    txt: 'plaintext',

    // Programming languages
    py: 'python',
    java: 'java',
    rb: 'ruby',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    swift: 'swift',
    kotlin: 'kotlin',
    groovy: 'groovy',
    scala: 'scala',
    dart: 'dart',

    // Shell & scripting
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    bat: 'batch',
    ps1: 'powershell',

    // Build files
    gradle: 'groovy',

    // Docker
    dockerfile: 'dockerfile',

    // Other
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
  };
  return map[ext.toLowerCase()] || 'plaintext';
};
