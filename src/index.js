import { types, traverse } from 'babel-core';

export function extractBody(fn, scope = fn.scope, visitor) {
  const body = fn.get('body');
  const args = [];
  const params = fn.get('params');

  for (let param of params) {
    let name = param.node.name;
    let id = scope.generateUid(name);
    fn.scope.rename( name, id );
    fn.scope.moveBindingTo( id, scope );
    scope.push( { id: param.node } );
  }

  body.traverse(Object.assign({}, visitor, {
    Identifier(node, parent, s) {
      let name = node.name;

      if (fn.scope.hasOwnBinding( name ) &&
          fn.scope.getOwnBinding( name ).kind !== 'param') {
        let id = scope.generateUid(name);
        fn.scope.rename( name, id );
        fn.scope.moveBindingTo( id, scope );
        scope.push( { id: node } );
      }

      traverse(parent, visitor, s, this.state, this.parentPath);
    },
    'AssignmentExpression|UpdateExpression'(node, parent, s) {
      let left = node.left;
      let binding = scope.getOwnBinding( left.name );

      // interestingly, this works as the binding retains its kind
      // even when moved out of its previous scope
      if (binding && binding.kind === 'param') {
        //console.log('warning: modifying parameter value!');
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
          var callee = this.get('callee');
          var args = this.get('arguments');

          if (callee.isMemberExpression({ computed: false}) &&
              callee.get('object').isGenericType('Array') &&
              args[0].isFunctionExpression()) {

            var fn = args[0];
            var params  = fn.scope.block.params;

            if (callee.get('property').isIdentifier({ name: 'map' })) {
              var id = scope.generateUidIdentifierBasedOnNode(node);
              var array = callee.get('object').node;

              var ref;

              scope.push({ id, init: t.arrayExpression([]) });

              if (params.length < 1) {
                params[0] = scope.generateDeclaredUidIdentifier('currentValue');
              }

              if (params.length < 2) {
                params[1] = scope.generateDeclaredUidIdentifier('index');
              }

              if (params.length < 3) {
                params[2] = scope.generateDeclaredUidIdentifier('array');
              }

              const body = extractBody(fn, scope, {
                ReturnStatement(node, parent) {
                  return [
                    t.expressionStatement(t.assignmentExpression('=', t.memberExpression(id, params[1], true), node.argument)),
                    t.continueStatement()
                  ];
                },
                ThisExpression(node) {
                  if (args[1] && !ref) {
                    ref = scope.generateDeclaredUidIdentifier('this');
                    this.getStatementParent().insertBefore(t.expressionStatement(t.assignmentExpression('=', ref, args[1].node)));
                  }
                  return ref || node;
                },
              });

              this.getStatementParent().insertBefore([
                t.forStatement(
                  t.assignmentExpression('=', params[0], t.memberExpression(
                    t.assignmentExpression('=', params[2], array),
                    t.assignmentExpression('=', params[1], t.literal(0)),
                    true)),
                  t.binaryExpression('<', params[1], t.memberExpression(params[2], t.identifier('length'))),
                  t.assignmentExpression('=', params[0], t.memberExpression(params[2],
                    t.updateExpression('++', params[1], true),
                    true)),
                  t.blockStatement(body)
                )
              ]);
              this.replaceWith(id);
              return;
            }
          }
          return node;
        }
      }
    }
  });
};
