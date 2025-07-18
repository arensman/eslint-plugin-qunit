/**
 * @fileoverview Forbid the use of QUnit.stop.
 * @author Kevin Partington
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const utils = require("../utils");

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: "suggestion",
        docs: {
            description: "disallow QUnit.stop",
            category: "Possible Errors",
            url: "https://github.com/platinumazure/eslint-plugin-qunit/blob/main/docs/rules/no-qunit-stop.md",
        },
        messages: {
            noQUnitStop: "Use assert.async() instead of QUnit.stop().",
        },
        schema: [],
    },

    create: function (context) {
        /**
         * @param {import('estree').Node} calleeNode
         * @returns {boolean}
         */
        function isQUnitStop(calleeNode) {
            return (
                calleeNode &&
                calleeNode.type === "MemberExpression" &&
                utils.isStop(calleeNode)
            );
        }

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

        return {
            CallExpression: function (node) {
                if (isQUnitStop(node.callee)) {
                    context.report({
                        node: node,
                        messageId: "noQUnitStop",
                    });
                }
            },
        };
    },
};
