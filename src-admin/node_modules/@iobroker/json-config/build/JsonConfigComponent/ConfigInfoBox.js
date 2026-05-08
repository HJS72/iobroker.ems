import React from 'react';
import { Box } from '@mui/material';
import { InfoBox } from '@iobroker/adapter-react-v5';
import ConfigGeneric from './ConfigGeneric';
export default class ConfigInfoBox extends ConfigGeneric {
    renderItem() {
        return (React.createElement(InfoBox, { type: this.props.schema.boxType || 'info', closeable: this.props.schema.closeable !== undefined ? this.props.schema.closeable : true, storeId: this.props.schema.closed !== undefined
                ? undefined
                : `${!!this.props.oContext.adapterName} ${this.props.attr}`, closed: this.props.schema.closed, style: { width: '100%', ...this.props.schema.style } },
            this.props.schema.title ? (React.createElement(Box, { component: "div", sx: { fontWeight: 'bold', fontSize: 'larger' } }, this.getText(this.props.schema.title))) : null,
            this.getText(this.props.schema.text)));
    }
}
//# sourceMappingURL=ConfigInfoBox.js.map