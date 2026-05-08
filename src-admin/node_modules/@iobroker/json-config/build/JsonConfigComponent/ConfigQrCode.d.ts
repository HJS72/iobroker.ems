import { type JSX } from 'react';
import type QRCode from 'react-qr-code';
import type { ConfigItemQrCode } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigQrCodeProps extends ConfigGenericProps {
    schema: ConfigItemQrCode;
}
interface ConfigQrCodeState extends ConfigGenericState {
    QRCode: typeof QRCode | null;
}
declare class ConfigQrCode extends ConfigGeneric<ConfigQrCodeProps, ConfigQrCodeState> {
    componentDidMount(): Promise<void>;
    renderItem(): JSX.Element | null;
}
export default ConfigQrCode;
