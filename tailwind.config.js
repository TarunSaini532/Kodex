module.exports = {
  theme: {
    extend: {
      colors: {
        kodex: {
          // Core backgrounds
          bg: "#0A0A0A", // The Void
          surface: "#121212", // The Floor
          editor: "#1A1A1A", // The Mat
          border: "#252525", // Structural Dividers
          hover: "#1F1F1F", // Surface Hover

          // Accent & Text
          accent: "#F4D03F", // Mastery Gold
          "accent-muted": "rgba(244, 208, 63, 0.1)", // For soft glows/highlights
          text: "#F0F0F0", // Main Ink
          muted: "#8A8A8A", // Secondary Text / Comments

          // Status colors
          danger: "#FF6B6B",
          success: "#4ADE80",

          // Interaction
          focus: "#F4D03F", // Consistent with accent
          selection: "#2A2617", // Deep amber for text highlighting
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      // Adding a sharp "Dojo" radius
      borderRadius: {
        kodex: "4px",
      },
    },
  },
};
