const TEXT_CONST = 'textRenderFn$POSTFIX$(component, $VAL$)';

const EMPTY = 'emptyRenderFn$POSTFIX$';

const PUSH_ROOT_ELE = 'component[ROOT_NODES$POSTFIX$].push(el);';
const PUSH_COM_ELE = 'component[NON_ROOT_COMPONENT_NODES$POSTFIX$].push(el);';
const SET_REF_ELE = 'vm_0[SET_REF_NODE$POSTFIX$](\'$NAME$\', el, component)';

const TEXT_EXPR = `(() => {
  const el = createTextNode$POSTFIX$();
$CODE$
  $PUSH_ELE$
  return el;
})()`;

const ATTR_I18N_COMP_CONST_ON = `const fn_$ROOT_INDEX$ = () => {
  attrs.$NAME$ = i18n$POSTFIX$[I18N_GET_TEXT$POSTFIX$]($I18N_KEY$);
};
fn_$ROOT_INDEX$();`;

const ATTR_I18N_COMP_CONST_OFF = 'el[I18N_WATCH$POSTFIX$](fn_$ROOT_INDEX$);';

const ATTR_I18N_COMP_EXPR_ON = `const rls_$ROOT_INDEX$ = new RelatedListenersStore$POSTFIX$();
const fn_$ROOT_INDEX$ = () => {
  rls_$ROOT_INDEX$.d();
  i18n$POSTFIX$[I18N_GET_ATTRIBUTE_RENDER$POSTFIX$]($I18N_KEY$)(attrs, '$NAME$', false, rls_$ROOT_INDEX$, $VMS$);
};
fn_$ROOT_INDEX$();`;

const ATTR_I18N_COMP_EXPR_OFF = `el[I18N_WATCH$POSTFIX$](fn_$ROOT_INDEX$);
el[ON$POSTFIX$](BEFORE_DESTROY_EVENT_NAME$POSTFIX$, () => rls_$ROOT_INDEX$.d());`;

const ATTR_I18N_DOM_CONST = `const fn_$ROOT_INDEX$ = () => {
  setAttribute$POSTFIX$(el, '$NAME$', i18n$POSTFIX$[I18N_GET_TEXT$POSTFIX$]($I18N_KEY$));
};
fn_$ROOT_INDEX$();
component[I18N_WATCH$POSTFIX$](fn_$ROOT_INDEX$);`;

const ATTR_I18N_DOM_EXPR = `const rls_$ROOT_INDEX$ = new RelatedListenersStore$POSTFIX$();
const fn_$ROOT_INDEX$ = () => {
  rls_$ROOT_INDEX$.d();
  i18n$POSTFIX$[I18N_GET_ATTRIBUTE_RENDER$POSTFIX$]($I18N_KEY$)(el, '$NAME$', true, rls_$ROOT_INDEX$, $VMS$);
};
fn_$ROOT_INDEX$();
component[I18N_WATCH$POSTFIX$](fn_$ROOT_INDEX$);
component[ON$POSTFIX$](BEFORE_DESTROY_EVENT_NAME$POSTFIX$, () => rls_$ROOT_INDEX$.d());`;

const I18N = `...(() => {
  const el = new I18nComponent$POSTFIX$(wrapAttrs$POSTFIX$({
    [VM_ATTRS$POSTFIX$]: null,
    [CONTEXT$POSTFIX$]: component[CONTEXT$POSTFIX$]
  }), $RENDER_KEY$, [$VMS$]);
  $CSTYLE_PID$
  $PUSH_ELE$
  return assertRenderResults$POSTFIX$(el[RENDER$POSTFIX$]());
})()`;

const PARAMETER = `...(() => {
  const __ac = $VM_RENDERER$[ARG_COMPONENTS$POSTFIX$];
  const renderFn = __ac && __ac['$ARG_USE$'] ? __ac['$ARG_USE$'] : $DEFAULT$;
  const attrs = wrapAttrs$POSTFIX$({
    $VM_DEBUG_NAME$
    $VM_PASS_INIT$
    [VM_ATTRS$POSTFIX$]: null,
    [CONTEXT$POSTFIX$]: component[CONTEXT$POSTFIX$],
    [ARG_COMPONENTS$POSTFIX$]: {
      [STR_DEFAULT$POSTFIX$]: renderFn || emptyRenderFn$POSTFIX$
    }
  });
$VM_PASS_SET$
  const el = new ParameterComponent$POSTFIX$(attrs, $VM_PASS_PARAM$);
$CSTYLE_PID$
$VM_PASS_WATCH$
$PUSH_ELE$
  return assertRenderResults$POSTFIX$(el[RENDER$POSTFIX$]());
})()`;

const ERROR = 'errorRenderFn$POSTFIX$';

module.exports = {
  SET_REF_ELE,
  PUSH_ROOT_ELE,
  PUSH_COM_ELE,
  TEXT_CONST,
  TEXT_EXPR,
  EMPTY,
  ERROR,
  PARAMETER,
  I18N,
  ATTR_I18N_DOM_CONST,
  ATTR_I18N_DOM_EXPR,
  ATTR_I18N_COMP_CONST_ON,
  ATTR_I18N_COMP_CONST_OFF,
  ATTR_I18N_COMP_EXPR_ON,
  ATTR_I18N_COMP_EXPR_OFF
};
