import { types, traverse } from 'babel-core';

export function extractBody(fn, scope = fn.scope, visitor) {
  const body = [];
  const args = [];

  fn.get('body').traverse(Object.assign({}, visitor, {
    Identifier(node, parent, s) {
      if (fn.scope.hasOwnBinding( node.name )) {
        let name = node.name;
        let id = scope.generateUid(name);

        if (fn.scope.getOwnBinding( name ).kind === 'param') {
          args.push( id );
        }

        fn.scope.rename( name, id );
        fn.scope.moveBindingTo( id, scope );
        scope.push( { id: node } );
      }

      traverse(parent, visitor, s, this.state, this.parentPath);
    },
    'AssignmentExpression|UpdateExpression'(node, parent, s) {
      var left = node.left;
      var binding = scope.getOwnBinding( left.name );

      if (args.indexOf( left.name ) >= 0) {
        //console.log('warning: modifying parameter value!');
      }

      traverse(parent, visitor, s, this.state, this.parentPath);
    },
    Statement: {
      exit(node, parent) {
        body.push(node);
      }
    }
  }), scope);


  return body;
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
              var decls = [
                t.variableDeclarator(t.identifier(id.name), t.arrayExpression([]))
              ];

              id.typeAnnotation = t.genericTypeAnnotation({ type: 'Identifier', name: 'Array'});

              if (params.length < 1) {
                params[0] = scope.generateDeclaredUidIdentifier('currentValue');
              }

              if (params.length < 2) {
                params[1] = scope.generateDeclaredUidIdentifier('index');
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
                    ref = scope.generateUidIdentifier('this');
                    scope.push( { id: ref });
                    decls.push(t.variableDeclarator(ref, args[1].node));
                  }
                  return ref || node;
                },
              });

              if (params.length > 2) {
                fn.scope.rename( params[2].name, array.name );
              }

              this.getStatementParent().insertBefore([
                t.variableDeclaration('var', decls),
                t.forStatement(
                  t.assignmentExpression('=', params[0], t.memberExpression(array,
                    t.assignmentExpression('=', params[1], t.literal(0)),
                    true)),
                  t.binaryExpression('<', params[1], t.memberExpression(array, t.identifier('length'))),
                  t.assignmentExpression('=', params[0], t.memberExpression(array,
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
