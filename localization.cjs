// Translate source UI copy before React creates elements; never mutate the DOM
// or translate account data returned by the API.
const exempt = (name) => ['locale.ts', 'themes.ts', 'preferences.tsx'].some((file) => name.endsWith(file));

module.exports = function ({ types: t }) {
  return {
    visitor: {
      Program: {
        enter(path, state) { state.usedTranslation = false; },
        exit(path, state) {
          if (state.usedTranslation) path.unshiftContainer('body', t.importDeclaration(
            [t.importSpecifier(t.identifier('__translate'), t.identifier('translate'))],
            t.stringLiteral('/src/locale.ts')));
        },
      },
      StringLiteral(path, state) {
        if (!/[\u0600-\u06ff]/.test(path.node.value) || path.parentPath.isObjectProperty({ key: path.node }) || path.parentPath.isImportDeclaration()) return;
        if (exempt(state.filename)) return;
        const call = t.callExpression(t.identifier('__translate'), [t.stringLiteral(path.node.value)]);
        if (path.parentPath.isJSXAttribute()) path.replaceWith(t.jsxExpressionContainer(call));
        else path.replaceWith(call);
        state.usedTranslation = true;
        path.skip();
      },
      JSXText(path, state) {
        if (!/[\u0600-\u06ff]/.test(path.node.value) || exempt(state.filename)) return;
        path.replaceWith(t.jsxExpressionContainer(t.callExpression(t.identifier('__translate'), [t.stringLiteral(path.node.value.replace(/\s+/g, ' '))])));
        state.usedTranslation = true;
        path.skip();
      },
      TemplateLiteral: { exit(path, state) {
        if (!path.node.quasis.some(q => /[\u0600-\u06ff]/.test(q.value.raw)) || exempt(state.filename)) return;
        path.replaceWith(t.callExpression(t.identifier('__translate'), [path.node]));
        state.usedTranslation = true;
        path.skip();
      } },
    },
  };
};
