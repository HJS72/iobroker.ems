import React from 'react';
import { FormHelperText, FormControl } from '@mui/material';
import ConfigGeneric from './ConfigGeneric';
import ChipInput from './ChipInput';
import { I18n } from '@iobroker/adapter-react-v5';
class ConfigChip extends ConfigGeneric {
    componentDidMount() {
        super.componentDidMount();
        const { data, attr } = this.props;
        const value = ConfigGeneric.getValue(data, attr);
        if (this.props.schema.delimiter && typeof value === 'string') {
            const parts = value
                .split(this.props.schema.delimiter)
                .map(a => a.trim())
                .filter(a => a);
            this.setState({ value: parts });
        }
        else {
            this.setState({ value: value || [] });
        }
    }
    renderItem(error, disabled) {
        const { attr, schema } = this.props;
        const { value } = this.state;
        return (React.createElement(FormControl, { fullWidth: true, variant: "standard" },
            React.createElement(ChipInput, { value: value, disabled: !!disabled, label: this.getText(schema.label), error: !!error, onAdd: chip => {
                    const newValue = JSON.parse(JSON.stringify(value));
                    newValue.push(chip);
                    this.setState({ value: newValue }, () => {
                        let mayBePromise;
                        if (this.props.schema.delimiter) {
                            mayBePromise = this.onChange(attr, newValue.join(`${this.props.schema.delimiter} `));
                        }
                        else {
                            mayBePromise = this.onChange(attr, newValue);
                        }
                        if (mayBePromise instanceof Promise) {
                            mayBePromise.catch(e => console.error(e));
                        }
                    });
                }, theme: this.props.oContext.theme, onDelete: (_chip, index) => {
                    const newValue = JSON.parse(JSON.stringify(value));
                    newValue.splice(index, 1);
                    this.setState({ value: newValue }, () => {
                        let mayBePromise;
                        if (this.props.schema.delimiter) {
                            mayBePromise = this.onChange(attr, newValue.join(`${this.props.schema.delimiter} `));
                        }
                        else {
                            mayBePromise = this.onChange(attr, newValue);
                        }
                        if (mayBePromise instanceof Promise) {
                            mayBePromise.catch(e => console.error(e));
                        }
                    });
                } }),
            React.createElement(FormHelperText, null, I18n.t('ra_Press ENTER Key to add new item')),
            this.props.schema.help ? (React.createElement(FormHelperText, null, this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation))) : null));
    }
}
export default ConfigChip;
//# sourceMappingURL=ConfigChip.js.map