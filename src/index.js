
export function extractBody( fn, scope = fn.scope ) {
  var body = [];
  var id;

  for (var name in fn.scope.bindings) {
    if (fn.scope.bindings[ name ].scope === fn.scope) {
      id = scope.generateUidIdentifier(name);
      fn.scope.rename( name, id.name );
      scope.push( { id } );
    }
  }

  fn.get('body').traverse({
    ReturnStatement(node, parent) {
      this.replaceWithMultiple([
        t.expressionStatement(t.assignmentExpression('=', t.memberExpression(id, index, true), node.argument)),
        t.continueStatement()
      ]);
    },
    ThisExpression(node) {
      if (args[1] && !ref) {
        ref = declare(scope.generateUidIdentifier('this'), args[1].node);
      }
      return ref || node;
    },
    Statement(node, parent) {
      body.push(node);
    }
  }, scope);


  return body;
};

export default function ({ Plugin, types: t }) {

  return new Plugin("reloop", {
    visitor: {
      Function: {
        enter() {
          this.skip();
        }
      },
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
              var currentValue;
              var index;

              var ref;
              var decls = [
                t.variableDeclarator(t.identifier(id.name), t.arrayExpression([]))
              ];
              var body = [
              ];

              id.typeAnnotation = t.genericTypeAnnotation({ type: 'Identifier', name: 'Array'});

              function declare( identifier, value ) {
                decls.push(t.variableDeclarator(identifier, value));
                return identifier;
              }

              /*
              for (var name in fn.scope.bindings) {
                if (fn.scope.bindings[ name ].scope === fn.scope) {
                  fn.scope.rename( name, declare(scope.generateUidIdentifier(name)).name );
                }
              }
              */

              if (params.length > 0) {
                currentValue = params[0];
              } else {
                currentValue = declare(scope.generateUidIdentifier('currentValue'));
              }

              if (params.length > 1) {
                index = params[1];
              } else {
                index = declare(scope.generateUidIdentifier('index'));
              }

              if (params.length > 2) {
                fn.scope.rename( params[2].name, array.name );
              }

              /*
              fn.get('body').traverse({
                ReturnStatement(node, parent) {
                  this.replaceWithMultiple([
                    t.expressionStatement(t.assignmentExpression('=', t.memberExpression(id, index, true), node.argument)),
                    t.continueStatement()
                  ]);
                },
                ThisExpression(node) {
                  if (args[1] && !ref) {
                    ref = declare(scope.generateUidIdentifier('this'), args[1].node);
                  }
                  return ref || node;
                },
                Statement(node, parent) {
                  body.push(node);
                }
              }, scope);
              */
             body = body.concat( extractBody( fn, scope ) );

              this.getStatementParent().insertBefore([
                t.variableDeclaration('var', decls),
                t.forStatement(
                  t.assignmentExpression('=', currentValue, t.memberExpression(array,
                    t.assignmentExpression('=', index, t.literal(0)),
                    true)),
                  t.binaryExpression('<', index, t.memberExpression(array, t.identifier('length'))),
                  t.assignmentExpression('=', currentValue, t.memberExpression(array,
                    t.updateExpression('++', index, true),
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
