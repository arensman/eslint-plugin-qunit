/**
 * @fileoverview forbid comparing relational expression to boolean in assertions
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
        type: "suggestion",
        docs: {
            description:
                "disallow comparing relational expressions to booleans in assertions",
            category: "Best Practices",
            url: "https://github.com/platinumazure/eslint-plugin-qunit/blob/main/docs/rules/no-compare-relation-boolean.md",
        },
        fixable: "code",
        messages: {
            redundantComparison:
                "Redundant comparison of relational expression to boolean literal.",
        },
        schema: [],
    },

    create: function (context) {
        /** @type {Array<{assertContextVar: string | null}>} */
        const testStack = [],
            RELATIONAL_OPS = new Set([
                "==",
                "!=",
                "===",
                "!==",
                "<",
                "<=",
                ">",
                ">=",
                "in",
                "instanceof",
            ]);

        /**
         * @param {import('estree').Node} calleeNode
         * @returns {boolean}
         */
        function shouldCheckArguments(calleeNode) {
            assert.ok(testStack.length);

            const assertContextVar =
                testStack[testStack.length - 1].assertContextVar;

            if (!assertContextVar) {
                return false;
            }

            return (
                utils.isAssertion(calleeNode, assertContextVar) &&
                utils.isComparativeAssertion(calleeNode, assertContextVar)
            );
        }

        /**
         * @param {import('estree').Node} a
         * @param {import('estree').Node} b
         * @returns {0 | 1 | -1}
         */
        function sortLiteralFirst(a, b) {
            if (a.type === "Literal" && b.type !== "Literal") {
                return -1; // Literal is first and should remain first
            }

            if (a.type !== "Literal" && b.type === "Literal") {
                return 1; // Literal is second and should be first
            }

            return 0;
        }

        /**
         * @param {import('estree').CallExpression} callExprNode
         * @param {import('estree').Literal} literalNode
         * @param {import('estree').BinaryExpression} binaryExprNode
         */
        function checkAndReport(callExprNode, literalNode, binaryExprNode) {
            if (
                binaryExprNode.type === "BinaryExpression" &&
                RELATIONAL_OPS.has(binaryExprNode.operator) &&
                literalNode.type === "Literal" &&
                typeof literalNode.value === "boolean"
            ) {
                context.report({
                    node: callExprNode,
                    messageId: "redundantComparison",
                    fix(fixer) {
                        const sourceCode = context.getSourceCode();
                        /* istanbul ignore next */
                        if (callExprNode.type !== "CallExpression") {
                            return null;
                        }
                        /* istanbul ignore next */
                        if (callExprNode.callee.type !== "MemberExpression") {
                            return null;
                        }
                        /* istanbul ignore next */
                        if (callExprNode.callee.object.type !== "Identifier") {
                            return null;
                        }
                        /* istanbul ignore next */
                        if (
                            callExprNode.callee.property.type !== "Identifier"
                        ) {
                            return null;
                        }
                        const assertionVariableName =
                            callExprNode.callee.object.name;

                        // Decide which assertion function to use based on how many negations we have.
                        let countNegations = 0;
                        if (
                            callExprNode.callee.property.name.startsWith("not")
                        ) {
                            countNegations++;
                        }
                        if (!literalNode.value) {
                            countNegations++;
                        }
                        const newAssertionFunctionName =
                            countNegations % 2 === 0 ? "ok" : "notOk";
                        const newArgsTextArray = [
                            binaryExprNode,
                            ...callExprNode.arguments.slice(2),
                        ].map((arg) => sourceCode.getText(arg));
                        const newArgsTextJoined = newArgsTextArray.join(", ");
                        return fixer.replaceText(
                            callExprNode,
                            `${assertionVariableName}.${newAssertionFunctionName}(${newArgsTextJoined})`,
                        );
                    },
                });
            }
        }

        /**
         * @param {import('estree').CallExpression} callExprNode
         */
        function checkAssertArguments(callExprNode) {
            if (callExprNode.type !== "CallExpression") {
                return;
            }
            const args = [...callExprNode.arguments];
            if (args.length < 2) {
                return;
            }

            const firstTwoArgsSorted = args.slice(0, 2).sort(sortLiteralFirst);

            if (
                firstTwoArgsSorted[0].type === "Literal" &&
                firstTwoArgsSorted[1].type === "BinaryExpression"
            ) {
                checkAndReport(
                    callExprNode,
                    firstTwoArgsSorted[0],
                    firstTwoArgsSorted[1],
                );
            }
        }

        return {
            CallExpression: function (node) {
                if (utils.isTest(node.callee)) {
                    testStack.push({
                        assertContextVar: utils.getAssertContextNameForTest(
                            node.arguments,
                        ),
                    });
                } else if (
                    testStack.length > 0 &&
                    shouldCheckArguments(node.callee)
                ) {
                    checkAssertArguments(node);
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
