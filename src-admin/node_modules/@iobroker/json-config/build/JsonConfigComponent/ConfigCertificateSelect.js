import React from 'react';
import { InputLabel, MenuItem, FormControl, Select, FormHelperText } from '@mui/material';
import { I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
class ConfigCertificateSelect extends ConfigGeneric {
    async componentDidMount() {
        super.componentDidMount();
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        // Important: getCertificates is only available in AdminConnection
        const certificates = await this.props.oContext.socket.getCertificates();
        const selectOptions = certificates
            .filter(el => {
            const name = this.props.attr.toLowerCase();
            if (name.includes(el.type)) {
                return true;
            }
            if (el.type === 'public' && name.includes('cert')) {
                return true;
            }
            if (el.type === 'private' && (name.includes('priv') || name.includes('key'))) {
                return true;
            }
            return !!(el.type === 'chained' && (name.includes('chain') || name.includes('ca')));
        })
            .map(el => ({ label: el.name, value: el.name }));
        selectOptions.unshift({ label: I18n.t(ConfigGeneric.NONE_LABEL), value: ConfigGeneric.NONE_VALUE });
        this.setState({ value, selectOptions });
    }
    renderItem(error, disabled /* , defaultValue */) {
        if (!this.state.selectOptions) {
            return null;
        }
        const item = this.state.selectOptions?.find(_item => _item.value === this.state.value);
        return (React.createElement(FormControl, { style: { width: '100%' }, variant: "standard" },
            this.props.schema.label ? (React.createElement(InputLabel, { shrink: true }, this.getText(this.props.schema.label))) : null,
            React.createElement(Select, { variant: "standard", error: !!error, displayEmpty: true, disabled: !!disabled, value: this.state.value, renderValue: () => this.getText(item?.label, this.props.schema.noTranslation !== false), onChange: e => this.setState({ value: e.target.value }, () => this.onChange(this.props.attr, this.state.value)) }, this.state.selectOptions?.map(item_ => (React.createElement(MenuItem, { key: item_.value, value: item_.value, style: item_.value === ConfigGeneric.NONE_VALUE ? { opacity: 0.5 } : {} }, this.getText(item_.label, this.props.schema.noTranslation !== false))))),
            this.props.schema.help ? (React.createElement(FormHelperText, null, this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation))) : null));
    }
}
export default ConfigCertificateSelect;
//# sourceMappingURL=ConfigCertificateSelect.js.map