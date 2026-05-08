import React from 'react';
import ConfigGeneric from './ConfigGeneric';
class ConfigDeviceManager extends ConfigGeneric {
    renderItem() {
        const schema = this.props.schema;
        if (!schema) {
            return null;
        }
        if (this.props.oContext.DeviceManager) {
            const DeviceManager = this.props.oContext.DeviceManager;
            return (React.createElement(DeviceManager, { uploadImagesToInstance: `${this.props.oContext.adapterName}.${this.props.oContext.instance}`, title: this.getText(this.props.schema.label), socket: this.props.oContext.socket, selectedInstance: `${this.props.oContext.adapterName}.${this.props.oContext.instance}`, themeName: this.props.themeName, theme: this.props.oContext.theme, themeType: this.props.oContext.themeType, isFloatComma: this.props.oContext.isFloatComma, dateFormat: this.props.oContext.dateFormat }));
        }
        return React.createElement("div", null, "DeviceManager not found");
    }
}
export default ConfigDeviceManager;
//# sourceMappingURL=ConfigDeviceManager.js.map