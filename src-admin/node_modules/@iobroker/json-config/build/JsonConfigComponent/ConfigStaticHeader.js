import React from 'react';
import { Box } from '@mui/material';
import ConfigGeneric from './ConfigGeneric';
const styles = {
    header: (theme) => ({
        width: '100%',
        background: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        padding: '4px !important',
        borderRadius: '3px',
        marginBlockEnd: 0,
        marginBlockStart: 0,
    }),
};
class ConfigStaticHeader extends ConfigGeneric {
    renderItem( /* error: string, disabled: boolean, defaultValue */) {
        let component = 'h5';
        switch ((this.props.schema.size || 5).toString()) {
            case '1':
                component = 'h1';
                break;
            case '2':
                component = 'h2';
                break;
            case '3':
                component = 'h3';
                break;
            case '4':
                component = 'h4';
                break;
            case '5':
            default:
                component = 'h5';
                break;
        }
        return (React.createElement(Box, { component: component, sx: styles.header }, this.getText(this.props.schema.label || this.props.schema.text, this.props.schema.noTranslation)));
    }
}
export default ConfigStaticHeader;
//# sourceMappingURL=ConfigStaticHeader.js.map