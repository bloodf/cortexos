// Rule: local/no-bash-c-in-template
//
// Bans `bash -c` in any string literal inside a .svelte or .ts file.
//
// Rationale: `bash -c <arg>` where `<arg>` is a string we built from
// user input is the textbook shell-injection sink. In CortexOS the
// privileged-command surface (m1-backend-skeleton) issues commands
// through an explicit allow-list + approval-token flow, never through
// a shell. So if `bash -c` shows up in a Svelte/TS file at all, it's
// almost certainly a mistake — either a copy-paste from a tutorial,
// or someone trying to dodge the command-allowlist.
//
// Detection: any Literal node whose value contains the substring
// `bash -c` (or `bash\u00a0-c`, `bash\t-c`, `bash  -c` to catch
// spacing variations). We look at Literal, TemplateElement, and
// JSXAttribute string values.
//
// Fix: replace with the explicit command primitive from the backend
// (e.g. `commands.run('id')` instead of `bash -c "id"`).

'use strict';

const BASH_C_PATTERN = /\bbash\s+-c\b/;

function checkString(node, value, context) {
  if (typeof value !== 'string') return;
  if (!BASH_C_PATTERN.test(value)) return;
  context.report({
    node,
    message:
      'Banned: `bash -c` in a string literal. Use the explicit command primitive from the backend (commands.run) — bash -c is a shell-injection vector. See THREAT_MODEL.md SR-019.',
  });
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ban `bash -c` in string literals — shell-injection vector.',
    },
    schema: [],
    messages: {},
  },
  create(context) {
    return {
      Literal(node) {
        checkString(node, node.value, context);
      },
      TemplateElement(node) {
        // TemplateElement.value.cooked is the resolved string fragment
        if (node.value && typeof node.value.cooked === 'string') {
          checkString(node, node.value.cooked, context);
        }
      },
    };
  },
};
