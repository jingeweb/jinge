const TEXT_CONST = `(() => {
  const el = createTextNode_$ID$($VAL$);
  component[ROOT_NODES_$ID$].push(el);
  return el;
})()`;

const EMPTY = `function(component) {
  const el = createComment_$ID$(STR_EMPTY_$ID$);
  component[ROOT_NODES_$ID$].push(el);
  return el;
}`;

const PUSH_ROOT_ELE = 'component[ROOT_NODES_$ID$].push(el);';
const PUSH_COM_ELE = 'component[NON_ROOT_COMPONENT_NODES_$ID$].push(el);';
const SET_REF_ELE = `if ('$NAME' in component[REF_NODES_$ID$]) {
  throw new Error('child ref name: '$NAME$' is duplicated.');
} else {
  component[REF_NODES_$ID$]['$NAME$'] = el;'
}`;

const TEXT_EXPR = `(() => {
  const el = createTextNode_$ID$('');
  const fn = () => setText_$ID$(el, $EXPR$);
$WATCH$
  fn();
  $PUSH_ELE$
  return el;
})()`;

const PARAMETER = '(component[ARG_COMPONENTS_$ID$][$ARG_USE$]$DEFAULT$)(component)';

module.exports = {
  SET_REF_ELE,
  PUSH_ROOT_ELE,
  PUSH_COM_ELE,
  TEXT_CONST,
  TEXT_EXPR,
  EMPTY,
  PARAMETER
};
