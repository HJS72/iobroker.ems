import React from 'react';
import { ChromePicker } from 'react-color';
import { IconButton, TextField, Dialog } from '@mui/material';
import { Close as ClearIcon } from '@mui/icons-material';
import { Utils } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
class ConfigColor extends ConfigGeneric {
    renderColorDialog() {
        return (!!this.state.showColorDialog && (React.createElement(Dialog, { onClose: () => this.setState({ showColorDialog: false }), open: this.state.showColorDialog },
            React.createElement(ChromePicker, { color: this.state.colorDialogValue, onChange: (color) => this.setState({ colorDialogValue: color.hex }, () => this.onChange(this.props.attr, this.state.colorDialogValue)) }))));
    }
    renderItem(_error, disabled /* , defaultValue */) {
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        let textColor = Utils.isUseBright(value, null);
        if (textColor === null) {
            textColor = undefined;
        }
        return (React.createElement(React.Fragment, null,
            this.renderColorDialog(),
            React.createElement(TextField, { variant: "standard", disabled: !!disabled, style: { minWidth: 100, width: 'calc(100% - 8px)' }, label: this.getText(this.props.schema.label), value: value || '', onClick: () => !this.props.schema.readOnly &&
                    this.setState({ showColorDialog: true, colorDialogValue: value || '' }), onChange: e => {
                    const color = e.target.value;
                    const mayBePromise = this.onChange(this.props.attr, color);
                    if (mayBePromise instanceof Promise) {
                        void mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
                    }
                }, slotProps: {
                    htmlInput: {
                        style: {
                            // paddingLeft: noPadding ? 0 : 8,
                            backgroundColor: value,
                            color: textColor ? '#FFF' : '#000',
                        },
                        readOnly: this.props.schema.readOnly || false,
                    },
                    input: {
                        endAdornment: !this.props.schema.readOnly && value && !this.props.schema.noClearButton ? (React.createElement(IconButton, { tabIndex: -1, size: "small", onClick: e => {
                                e.stopPropagation();
                                const mayBePromise = this.onChange(this.props.attr, '');
                                if (mayBePromise instanceof Promise) {
                                    void mayBePromise.catch(e => console.error(`Cannot set value: ${e}`));
                                }
                            } },
                            React.createElement(ClearIcon, null))) : undefined,
                    },
                    inputLabel: {
                        shrink: true,
                    },
                } })));
    }
}
export default ConfigColor;
//# sourceMappingURL=ConfigColor.js.map