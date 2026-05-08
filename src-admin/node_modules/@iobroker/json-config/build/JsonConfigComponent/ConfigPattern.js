import React from 'react';
import { IconButton, TextField } from '@mui/material';
import { I18n, IconCopy, Utils } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
class ConfigPattern extends ConfigGeneric {
    renderItem(_error, disabled) {
        return (React.createElement(TextField, { variant: "standard", fullWidth: true, disabled: !!disabled, slotProps: {
                input: {
                    endAdornment: this.props.schema.copyToClipboard ? (React.createElement(IconButton, { tabIndex: -1, size: "small", onClick: () => {
                            Utils.copyToClipboard(this.getPattern(this.props.schema.pattern, null, this.props.schema.noTranslation));
                            window.alert(I18n.t('ra_Copied'));
                        } },
                        React.createElement(IconCopy, null))) : undefined,
                },
            }, value: this.getPattern(this.props.schema.pattern, null, true), label: this.getText(this.props.schema.label), helperText: this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation) }));
    }
}
export default ConfigPattern;
//# sourceMappingURL=ConfigPattern.js.map