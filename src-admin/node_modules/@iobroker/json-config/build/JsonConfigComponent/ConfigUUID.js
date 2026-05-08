import React from 'react';
import { TextField, IconButton } from '@mui/material';
import { ContentCopy as IconCopy } from '@mui/icons-material';
import { Utils, I18n } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
export default class ConfigUUID extends ConfigGeneric {
    async componentDidMount() {
        super.componentDidMount();
        const uuidObj = await this.props.oContext.socket.getObject('system.meta.uuid');
        this.setState({ uuid: uuidObj?.native?.uuid || 'unknown' });
    }
    renderItem(error, disabled) {
        return (React.createElement(TextField, { variant: "standard", fullWidth: true, error: !!error, disabled: !!disabled, slotProps: {
                htmlInput: { readOnly: true },
                input: {
                    endAdornment: (React.createElement(IconButton, { tabIndex: -1, onClick: () => {
                            Utils.copyToClipboard(this.state.uuid);
                            window.alert(I18n.t('ra_Copied %s', this.state.uuid));
                        } },
                        React.createElement(IconCopy, null))),
                },
            }, value: this.state.uuid || '', label: this.getText(this.props.schema.label) || I18n.t('ra_Serial number (UUID)'), helperText: this.renderHelp(this.props.schema.help, this.props.schema.helpLink, this.props.schema.noTranslation) }));
    }
}
//# sourceMappingURL=ConfigUUID.js.map