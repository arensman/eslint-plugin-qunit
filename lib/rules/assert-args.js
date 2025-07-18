/**
 * @fileoverview Check the number of arguments to QUnit's assertion functions.
 * @author Kevin Partington
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("node:assert"),
    utils = require("../utils");

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: "problem",
        docs: {
            description:
                "enforce that the correct number of assert arguments are used",
            category: "Possible Errors",
            url: "https://github.com/platinumazure/eslint-plugin-qunit/blob/main/docs/rules/assert-args.md",
        },
        messages: {
            unexpectedArgCount:
                "Unexpected call to {{callee}} with {{argCount}} arguments.",
            unexpectedArgCountNoMessage:
                "Unexpected call to {{callee}} with {{argCount}} arguments and no error message.",
        },
        schema: [],
    },

    create: function (context) {
        /** @type {Array<{assertContextVar: string | null}>} */
        const testStack = [],
            sourceCode = context.getSourceCode();

        /**
         * @param {import('estree').Node} argNode
         * @returns {import('estree').Node}
         */
        function isPossibleMessage(argNode) {
            // For now, we will allow all nodes. Hoping to allow user-driven
            // configuration later.
            // E.g., to allow string literals only:
            // return lastArg.type === "Literal" && typeof lastArg.value === "string";

            // For now, allowing all nodes to be possible messages.
            return argNode;
        }

        /**
         * @returns {string | null}
         */
        function getAssertContext() {
            assert.ok(testStack.length);

            return testStack[testStack.length - 1].assertContextVar;
        }

        /**
         * @param {import('estree').Node} callExpressionNode
         */
        function checkAssertArity(callExpressionNode) {
            if (callExpressionNode.type !== "CallExpression") {
                return;
            }

            const assertContextVar = getAssertContext();
            if (!assertContextVar) {
                return;
            }

            const allowedArities = utils.getAllowedArities(
                    callExpressionNode.callee,
                    assertContextVar,
                ),
                assertArgs = callExpressionNode.arguments,
                lastArg = assertArgs[assertArgs.length - 1],
                mayHaveMessage = lastArg && isPossibleMessage(lastArg);

            const definitelyTooFewArgs = allowedArities.every(function (arity) {
                return assertArgs.length < arity;
            });

            if (
                mayHaveMessage &&
                allowedArities.includes(assertArgs.length - 1)
            ) {
                return;
            } else if (allowedArities.includes(assertArgs.length)) {
                return;
            }

            context.report({
                node: callExpressionNode,
                messageId:
                    mayHaveMessage && !definitelyTooFewArgs
                        ? "unexpectedArgCount"
                        : "unexpectedArgCountNoMessage",
                data: {
                    callee: sourceCode.getText(callExpressionNode.callee),
                    argCount: assertArgs.length.toString(),
                },
            });
        }

        return {
            CallExpression: function (node) {
                if (utils.isTest(node.callee)) {
                    testStack.push({
                        assertContextVar: utils.getAssertContextNameForTest(
                            node.arguments,
                        ),
                    });
                } else if (testStack.length > 0) {
                    const assertContext = getAssertContext();
                    if (
                        assertContext &&
                        utils.isAssertion(node.callee, assertContext)
                    ) {
                        checkAssertArity(node);
                    }
                }
            },

            "CallExpression:exit": function (node) {
                if (utils.isTest(node.callee)) {
                    testStack.pop();
                }
            },
        };
    },
};
