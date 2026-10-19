import wordpress from "@wordpress/eslint-plugin";

export default [
  {
    ignores: ["assets/build/**", "vendor/**", "node_modules/**"],
  },
  ...wordpress.configs.recommended,
];
