const HTML_BOOL_IDL_ATTRS = {
  autocomplete: {
    tags: ['form', 'input']
  },
  autofocus: {
    tags: ['button', 'input', 'select', 'textarea']
  },
  autoplay: {
    tags: ['audio', 'video']
  },
  controls: {
    tags: ['audio', 'video']
  },
  disabled: {
    tags: ['button', 'fieldset', 'input', 'optgroup', 'option', 'select', 'textarea']
  },
  readonly: {
    tags: ['input', 'textarea'],
    reflect: 'readOnly'
  },
  required: {
    tags: ['input', 'textarea', 'select']
  },
  checked: {
    tags: ['input']
  },
  multiple: {
    tags: ['input', 'select']
  },
  muted: {
    tags: ['video', 'audio']
  },
  draggable: {
    tags: '*'
  }
};

/**
 * common idl attrs(but no all)
 */
const HTML_COMMON_IDL_ATTRS = {
  value: {
    tags: ['button', 'input', 'option', 'progress']
  }
};


module.exports = {
  HTML_BOOL_IDL_ATTRS,
  HTML_COMMON_IDL_ATTRS
};


