import React from 'react';
import { Box } from '@mui/material';
import { Utils } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
const styles = {
    fullWidth: (theme) => ({
        width: '100%',
        backgroundColor: theme.palette.mode === 'dark' ? '#FFF' : '#000',
        borderStyle: 'hidden',
    }),
    primary: (theme) => ({
        backgroundColor: theme.palette.primary.main,
    }),
    secondary: (theme) => ({
        backgroundColor: theme.palette.secondary.main,
    }),
};
class ConfigStaticDivider extends ConfigGeneric {
    renderItem() {
        return (React.createElement(Box, { component: "hr", sx: Utils.getStyle(this.props.oContext.theme, styles.fullWidth, this.props.schema.color === 'primary'
                ? styles.primary
                : this.props.schema.color === 'secondary'
                    ? styles.secondary
                    : {
                        backgroundColor: this.props.schema.color ||
                            (this.props.oContext.themeType === 'dark' ? '#333' : '#ddd'),
                    }, {
                height: this.props.schema.color ? this.props.schema.height || 2 : this.props.schema.height || 1,
            }) }));
    }
}
export default ConfigStaticDivider;
//# sourceMappingURL=ConfigStaticDivider.js.map