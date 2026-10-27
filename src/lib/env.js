/* global __STANDALONE__ */
// True only in the offline desktop copy (built via vite.standalone.config.js,
// which defines __STANDALONE__; the hosted build leaves it undeclared).
export const IS_STANDALONE = typeof __STANDALONE__ !== "undefined" && __STANDALONE__;