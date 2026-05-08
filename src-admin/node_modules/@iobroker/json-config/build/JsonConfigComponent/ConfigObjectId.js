import React from 'react';
import { InputLabel, FormControl, Button, TextField } from '@mui/material';
import { DialogSelectID } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
const styles = {
    flex: {
        display: 'flex',
    },
    button: {
        height: 48,
        marginLeft: 4,
        minWidth: 48,
    },
};
class ConfigObjectId extends ConfigGeneric {
    componentDidMount() {
        super.componentDidMount();
        const { data, attr } = this.props;
        const value = ConfigGeneric.getValue(data, attr) || '';
        this.setState({ value, initialized: true });
    }
    renderItem(error, disabled /* , defaultValue */) {
        if (!this.state.initialized) {
            return null;
        }
        const socket = this.props.oContext.socket;
        const { schema, attr } = this.props;
        const { value, showSelectId } = this.state;
        return (React.createElement(FormControl, { fullWidth: true, variant: "standard" },
            schema.label ? React.createElement(InputLabel, { shrink: true }, this.getText(schema.label)) : null,
            React.createElement("div", { style: styles.flex },
                React.createElement(TextField, { variant: "standard", fullWidth: true, value: value, error: !!error, disabled: disabled, placeholder: this.getText(schema.placeholder), label: this.getText(schema.label), helperText: this.renderHelp(schema.help, schema.helpLink, schema.noTranslation), onChange: e => {
                        const value_ = e.target.value;
                        this.setState({ value: value_ }, () => this.onChange(attr, value_));
                    } }),
                React.createElement(Button, { color: "grey", disabled: disabled, style: styles.button, size: "small", variant: "outlined", onClick: () => this.setState({ showSelectId: true }) }, "...")),
            showSelectId ? (React.createElement(DialogSelectID, { imagePrefix: this.props.oContext.imagePrefix === undefined ? '../..' : this.props.oContext.imagePrefix, dialogName: `admin.${this.props.oContext.adapterName}`, filterFunc: schema.filterFunc, themeType: this.props.oContext.themeType, theme: this.props.oContext.theme, types: schema.types ? (Array.isArray(schema.types) ? schema.types : [schema.types]) : undefined, customFilter: schema.customFilter, filters: schema.filters, socket: socket, selected: value, root: schema.root, onClose: () => this.setState({ showSelectId: false }), onOk: value_ => this.setState({ showSelectId: false, value: value_ }, () => this.onChange(attr, value_)) })) : null));
    }
}
export default ConfigObjectId;
//# sourceMappingURL=ConfigObjectId.js.map