const TEXT_CONST = 'textRenderFn$POSTFIX$(component, $VAL$)';

const EMPTY = 'emptyRenderFn$POSTFIX$';

const PUSH_ROOT_ELE = 'component[__$POSTFIX$].rootNodes.push(el);';
const PUSH_COM_ELE = 'component[__$POSTFIX$].nonRootCompNodes.push(el);';
const SET_REF_ELE = "vm_0.__setRef('$NAME$', el, component)";

const TEXT_EXPR = `(() => {
  const el = createTextNode$POSTFIX$();
$CODE$
  $PUSH_ELE$
  return el;
})()`;

const ATTR_I18N_COMP_CONST_ON = `const fn_$ROOT_INDEX$ = () => {
  attrs.$NAME$ = i18n$POSTFIX$.__t($I18N_KEY$);
};
fn_$ROOT_INDEX$();`;

const ATTR_I18N_COMP_CONST_OFF = 'el.__i18nWatch(fn_$ROOT_INDEX$);';

const ATTR_I18N_COMP_EXPR_ON = `const rls_$ROOT_INDEX$ = {
  [$$$POSTFIX$]: null
};
const fn_$ROOT_INDEX$ = () => {
  if (rls_$ROOT_INDEX$[$$$POSTFIX$]) {
    rls_$ROOT_INDEX$[$$$POSTFIX$].__destroy();
  }
  rls_$ROOT_INDEX$[$$$POSTFIX$] = new ViewModelCoreImpl$POSTFIX$({});
  i18n$POSTFIX$.__r($I18N_KEY$, 'attributes')(attrs, '$NAME$', false, rls_$ROOT_INDEX$, $VMS$);
};
fn_$ROOT_INDEX$();`;

const ATTR_I18N_COMP_EXPR_OFF = `el.__i18nWatch(fn_$ROOT_INDEX$);
el.__on('before-destroy', () => rls_$ROOT_INDEX$[$$$POSTFIX$].__destroy());`;

const ATTR_I18N_DOM_CONST = `const fn_$ROOT_INDEX$ = () => {
  el.setAttribute('$NAME$', i18n$POSTFIX$.__t($I18N_KEY$));
};
fn_$ROOT_INDEX$();
component.__i18nWatch(fn_$ROOT_INDEX$);`;

const ATTR_I18N_DOM_EXPR = `const rls_$ROOT_INDEX$ = {
  [$$$POSTFIX$]: null
};
const fn_$ROOT_INDEX$ = () => {
  if (rls_$ROOT_INDEX$[$$$POSTFIX$]) {
    rls_$ROOT_INDEX$[$$$POSTFIX$].__destroy();
  }
  rls_$ROOT_INDEX$[$$$POSTFIX$] = new ViewModelCoreImpl$POSTFIX$({});
  i18n$POSTFIX$.__r($I18N_KEY$, 'attributes')(el, '$NAME$', true, rls_$ROOT_INDEX$, $VMS$);
};
fn_$ROOT_INDEX$();
component.__i18nWatch(fn_$ROOT_INDEX$);
component.__on('before-destroy', () => rls_$ROOT_INDEX$.__destroy());`;

const I18N = `...(() => {
  const el = new I18nComponent$POSTFIX$(attrs$POSTFIX$({
    [__$POSTFIX$]: {
      context: component[__$POSTFIX$].context
    }
  }), $RENDER_KEY$, [$VMS$]);
  $PUSH_ELE$
  return assertRenderResults$POSTFIX$(el.__render());
})()`;

const PARAMETER = `...(() => {
  const __ac = $VM_RENDERER$[__$POSTFIX$].slots;
  const renderFn = __ac && __ac['$ARG_USE$'] ? __ac['$ARG_USE$'] : $DEFAULT$;
  const attrs = attrs$POSTFIX$({
    $VM_PASS_INIT$
    [__$POSTFIX$]: {
      $VM_DEBUG_NAME$
      context: component[__$POSTFIX$].context,
      slots: {
        default: renderFn || emptyRenderFn$POSTFIX$
      }
    }
  });
$VM_PASS_SET$
  const el = (new ParameterComponent$POSTFIX$(attrs, $VM_PASS_PARAM$))[$$$POSTFIX$].proxy;
$VM_PASS_WATCH$
$PUSH_ELE$
  return assertRenderResults$POSTFIX$(el.__render());
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
  ATTR_I18N_COMP_EXPR_OFF,
};
