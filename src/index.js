import { types, traverse } from 'babel-core';

export function extractBody(fn, scope = fn.scope, visitor) {
  const body = fn.get('body');
  const params = fn.get('params');

  function moveNodeBinding(node) {
    const name = node.name;
    const id = scope.generateUid(name);
    fn.scope.rename(name, id);
    fn.scope.moveBindingTo(id, scope);
    scope.push({ id: node });
  }

  for (let param of params) {
    let name = param.node.name;
    moveNodeBinding(param.node);
  }

  body.traverse(Object.assign({}, visitor, {
    Identifier(node, parent, s) {
      const name = node.name;
      const binding = fn.scope.getOwnBinding(name);

      if (name === 'arguments') {
        console.log('ARGHHHHSSS');
      }

      if (binding && binding.kind !== 'param') {
        moveNodeBinding(node);
      }

      traverse(parent, visitor, s, this.state, this.parentPath);
    },
    'AssignmentExpression|UpdateExpression'(node, parent, s) {
      const name = node.left.name;
      const binding = scope.getOwnBinding(name);

      // interestingly, this works as the binding retains its kind
      // even when moved out of its previous scope
      if (binding && binding.kind === 'param') {
        // TODO
      }

      traverse(parent, visitor, s, this.state, this.parentPath);
    }
  }), scope);

  return body.node.body;
};

export default function ({ Plugin, types: t }) {

  return new Plugin('relooper', {
    visitor: {
      CallExpression: {
        exit(node, parent, scope) {
          const callee = this.get('callee');
          const args = this.get('arguments');
          const object = callee.get('object');

          if (callee.isMemberExpression({ computed: false}) &&
              object.isGenericType('Array') &&
              args[0].isFunctionExpression()) {

            const callback = args[0];
            const thisArg = args[1];
            const params  = callback.scope.block.params;
            const statementParent = this.getStatementParent();

            if (callee.get('property').isIdentifier({ name: 'map' })) {
              const id = scope.generateUidIdentifierBasedOnNode(node);
              let ref;

              const currentValue = params[0] || scope.generateDeclaredUidIdentifier('currentValue');
              const index = params[1] || scope.generateDeclaredUidIdentifier('index');
              const array = params[2] || scope.generateDeclaredUidIdentifier('array');

              scope.push({ id, init: t.arrayExpression([]) });

              const body = extractBody(callback, scope, {
                ReturnStatement(node, parent) {
                  return [
                    t.expressionStatement(t.assignmentExpression('=', t.memberExpression(id, index, true), node.argument)),
                    t.continueStatement()
                  ];
                },
                ThisExpression(node) {
                  if (thisArg && !ref) {
                    ref = scope.generateDeclaredUidIdentifier('this');
                    statementParent.insertBefore(t.expressionStatement(t.assignmentExpression('=', ref, thisArg.node)));
                  }
                  return ref || node;
                },
              });

              statementParent.insertBefore([
                t.forStatement(
                  t.assignmentExpression('=', index, t.literal(0)),
                  t.binaryExpression('<', index, t.memberExpression(object.node, t.identifier('length'))),
                  t.updateExpression('++', index, true),
                  t.blockStatement([
                    t.expressionStatement(t.sequenceExpression([
                      t.assignmentExpression('=', currentValue, t.memberExpression(object.node, index, true)),
                      t.assignmentExpression('=', array, object.node)
                    ])),
                  ].concat(body))
                )
              ]);
              return id;
            }
          }
          return node;
        }
      }
    }
  });
};
