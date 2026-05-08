import React from 'react';
import { InputLabel, FormControl, Button, TextField } from '@mui/material';
import { DialogCron, I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
const styles = {
    fullWidth: {
        width: '100%',
    },
    flex: {
        display: 'flex',
    },
    button: {
        height: 48,
        marginLeft: 4,
        minWidth: 48,
    },
};
class ConfigCRON extends ConfigGeneric {
    componentDidMount() {
        super.componentDidMount();
        const { data, attr } = this.props;
        const value = ConfigGeneric.getValue(data, attr) || '';
        this.setState({ value, showDialog: false });
    }
    renderItem(error, disabled /* , defaultValue */) {
        const { schema, attr } = this.props;
        const { value, showDialog } = this.state;
        return (React.createElement(FormControl, { style: styles.fullWidth, variant: "standard" },
            schema.label ? React.createElement(InputLabel, { shrink: true }, this.getText(schema.label)) : null,
            React.createElement("div", { style: styles.flex },
                React.createElement(TextField, { variant: "standard", fullWidth: true, value: value ?? '', error: !!error, disabled: disabled, placeholder: this.getText(schema.placeholder), label: this.getText(schema.label), helperText: this.renderHelp(schema.help, schema.helpLink, schema.noTranslation), onChange: e => {
                        const value_ = e.target.value;
                        this.setState({ value: value_ }, () => this.onChange(attr, value_));
                    } }),
                React.createElement(Button, { color: "grey", disabled: disabled, style: styles.button, size: "small", variant: "outlined", onClick: () => this.setState({ showDialog: true }) }, "...")),
            showDialog ? (React.createElement(DialogCron, { title: I18n.t('ra_Define schedule'), simple: schema.simple, complex: schema.complex, cron: value, onClose: () => this.setState({ showDialog: false }), cancel: I18n.t('ra_Cancel'), ok: I18n.t('ra_Ok'), theme: this.props.oContext.theme, onOk: value_ => this.setState({ showDialog: false, value: value_ }, () => this.onChange(attr, value_)) })) : null));
    }
}
export default ConfigCRON;
//# sourceMappingURL=ConfigCRON.js.map