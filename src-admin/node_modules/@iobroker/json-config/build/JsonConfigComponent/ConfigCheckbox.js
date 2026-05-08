import React from 'react';
import { FormControlLabel, Checkbox, FormHelperText, FormControl } from '@mui/material';
import { I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
class ConfigCheckbox extends ConfigGeneric {
    renderItem(error, disabled) {
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        const isIndeterminate = Array.isArray(value);
        return (React.createElement(FormControl, { style: { width: '100%' }, variant: "standard" },
            React.createElement(FormControlLabel, { onClick: e => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!disabled) {
                        const mayByPromise = this.onChange(this.props.attr, !value);
                        if (mayByPromise instanceof Promise) {
                            void mayByPromise.catch(e => console.error(`Cannot set value: ${e}`));
                        }
                    }
                }, control: React.createElement(Checkbox, { indeterminate: isIndeterminate, checked: !!value, onChange: e => {
                        let mayBePromise;
                        if (isIndeterminate) {
                            mayBePromise = this.onChange(this.props.attr, true);
                        }
                        else {
                            mayBePromise = this.onChange(this.props.attr, e.target.checked);
                        }
                        if (mayBePromise instanceof Promise) {
                            void mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
                        }
                    }, disabled: disabled || this.props.schema.readOnly }), label: this.getText(this.props.schema.label) }),
            React.createElement(FormHelperText, { style: { color: 'red' } }, error
                ? this.props.schema.validatorErrorText
                    ? I18n.t(this.props.schema.validatorErrorText)
                    : I18n.t('ra_Error')
                : null),
            this.props.schema.help ? (React.createElement(FormHelperText, null, this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation))) : null));
    }
}
export default ConfigCheckbox;
//# sourceMappingURL=ConfigCheckbox.js.map