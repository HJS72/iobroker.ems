import React from 'react';
import ConfigGeneric from './ConfigGeneric';
class ConfigQrCode extends ConfigGeneric {
    async componentDidMount() {
        super.componentDidMount();
        // lazy load of qrcode
        const module = await import('react-qr-code');
        this.setState({ QRCode: module.default });
    }
    renderItem() {
        const QRCodeComponent = this.state.QRCode;
        if (!QRCodeComponent) {
            return null;
        }
        return (React.createElement(QRCodeComponent, { value: this.props.schema.data, size: this.props.schema.size, fgColor: this.props.schema.fgColor, bgColor: this.props.schema.bgColor, level: this.props.schema.level }));
    }
}
export default ConfigQrCode;
//# sourceMappingURL=ConfigQrCode.js.map