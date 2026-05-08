import React from 'react';
import { DatePicker } from '@mui/x-date-pickers';
import ConfigGeneric from './ConfigGeneric';
export default class ConfigDatePicker extends ConfigGeneric {
    componentDidMount() {
        super.componentDidMount();
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);
        this.setState({ value });
    }
    renderItem(_error, disabled /* , defaultValue */) {
        return (React.createElement(DatePicker, { sx: theme => ({
                width: '100%',
                borderBottom: `1px solid ${theme.palette.text.primary}`,
                '& fieldset': {
                    display: 'none',
                },
                '& input': {
                    padding: `${theme.spacing(1.5)} 0 4px 0`,
                },
                '& .MuiInputAdornment-root': {
                    marginLeft: 0,
                    marginTop: 1, // it is already in spaces
                },
                '& label': {
                    transform: 'translate(0px, -9px) scale(0.75)',
                },
            }), format: this.props.oContext.systemConfig.dateFormat.toLowerCase().replace('mm', 'MM'), disabled: !!disabled, value: this.state.value, onChange: value => {
                this.setState({ value }, () => this.onChange(this.props.attr, this.state.value));
            }, label: this.getText(this.props.schema.label) }));
    }
}
//# sourceMappingURL=ConfigDatePicker.js.map