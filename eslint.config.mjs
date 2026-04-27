import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        files: ["app/**/*.js"],
        ignores: ["app/browser-polyfill.min.js", "app/build.js"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                importScripts: "readonly",
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-param-reassign": "warn",
            "no-empty": "warn",
            "no-useless-escape": "off",
        },
    },
    {
        files: ["app/build.js"],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            ...js.configs.recommended.rules,
        },
    },
]);
