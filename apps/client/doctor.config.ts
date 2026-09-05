const config = {
  ignore: {
    rules: [
      // shadcn/ui generated patterns — not our code to modify
      'react-doctor/no-pass-data-to-parent',
      'react-doctor/no-pass-live-state-to-parent',
      'react-doctor/no-prop-callback-in-effect',
      'react-doctor/jsx-no-constructed-context-values',
      'react-doctor/only-export-components',
      // Tailwind standard pattern — transition-all is by design
      'react-doctor/no-transition-all',
      // Supply chain is external dependency concern, not code quality
      'socket/low-supply-chain-score',
      // Sequential API calls required for variant/image uploads
      'react-doctor/async-await-in-loop',
    ],
    files: [
      // shadcn/ui generated component files
      'src/components/ui/carousel.tsx',
      'src/components/ui/drawer.tsx',
      'src/components/ui/sheet.tsx',
    ],
  },
};

export default config;
