const TEXT_CONST = 'textRenderFn_$ID$(component, $VAL$)';

const EMPTY = 'emptyRenderFn_$ID$';

const PUSH_ROOT_ELE = 'component[ROOT_NODES_$ID$].push(el);';
const PUSH_COM_ELE = 'component[NON_ROOT_COMPONENT_NODES_$ID$].push(el);';
const SET_REF_ELE = 'vm_0[SET_REF_NODE_$ID$](\'$NAME$\', el, component)';

const TEXT_EXPR = `(() => {
  const el = createTextNode_$ID$('');
$CODE$
  $PUSH_ELE$
  return el;
})()`;

const PARAMETER = `...(() => {
  const __ac = $VM_RENDERER$[ARG_COMPONENTS_$ID$];
  const renderFn = __ac && __ac['$ARG_USE$'] ? __ac['$ARG_USE$'] : $DEFAULT$;
  const attrs = wrapAttrs_$ID$({
    $VM_DEBUG_NAME$
    $VM_PASS_INIT$
    [VM_ATTRS_$ID$]: null,
    [CONTEXT_$ID$]: component[CONTEXT_$ID$],
    [ARG_COMPONENTS_$ID$]: {
      [STR_DEFAULT_$ID$]: renderFn || emptyRenderFn_$ID$
    }
  });
$VM_PASS_SET$
  const el = new ParameterComponent_$ID$(attrs, $VM_PASS_PARAM$);
$CSTYLE_PID$
$VM_PASS_WATCH$
$PUSH_ELE$
  return assertRenderResults_$ID$(el[RENDER_$ID$]());
})()`;

const ERROR = 'errorRenderFn_$ID$';

module.exports = {
  SET_REF_ELE,
  PUSH_ROOT_ELE,
  PUSH_COM_ELE,
  TEXT_CONST,
  TEXT_EXPR,
  EMPTY,
  ERROR,
  PARAMETER
};
