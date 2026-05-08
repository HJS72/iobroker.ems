import React from 'react';
import { InputLabel, MenuItem, FormHelperText, FormControl, Select } from '@mui/material';
import { TextWithIcon, I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
class ConfigFunc extends ConfigGeneric {
    componentDidMount() {
        super.componentDidMount();
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        void this.props.oContext.socket.getEnums('functions').then(enums => {
            const selectOptions = Object.keys(enums).map(id => ({
                value: this.props.schema.short ? id.replace('enum.functions.', '') : id,
                label: this.getText(enums[id].common.name),
                obj: enums[id],
            }));
            if (this.props.schema.allowDeactivate !== false) {
                selectOptions.unshift({ label: I18n.t(ConfigGeneric.NONE_LABEL), value: ConfigGeneric.NONE_VALUE });
            }
            this.setState({ value, selectOptions });
        });
    }
    renderItem(error, disabled /* , defaultValue */) {
        if (!this.state.selectOptions) {
            return null;
        }
        const item = this.state.selectOptions.find(it => it.value === this.state.value);
        return (React.createElement(FormControl, { variant: "standard", fullWidth: true },
            this.props.schema.label ? React.createElement(InputLabel, null, this.getText(this.props.schema.label)) : null,
            React.createElement(Select, { variant: "standard", error: !!error, disabled: !!disabled, value: this.state.value || '_', renderValue: () => item ? (item.obj ? (React.createElement(TextWithIcon, { value: item.obj, themeType: this.props.oContext.themeType, lang: I18n.getLanguage() })) : (item.label)) : (''), onChange: e => {
                    this.setState({ value: e.target.value === '_' ? '' : e.target.value }, () => this.onChange(this.props.attr, this.state.value));
                } }, this.state.selectOptions.map(it => (React.createElement(MenuItem, { key: it.value, value: it.value, style: it.value === ConfigGeneric.DIFFERENT_VALUE ? { opacity: 0.5 } : {} }, it.obj ? (React.createElement(TextWithIcon, { value: it.obj, themeType: this.props.oContext.themeType, lang: I18n.getLanguage() })) : (it.label))))),
            this.props.schema.help ? (React.createElement(FormHelperText, null, this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation))) : null));
    }
}
export default ConfigFunc;
//# sourceMappingURL=ConfigFunc.js.map