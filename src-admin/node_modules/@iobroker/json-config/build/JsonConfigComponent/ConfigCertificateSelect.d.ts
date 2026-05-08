import { type JSX } from 'react';
import type { ConfigItemCertificateSelect } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigCertificateSelectProps extends ConfigGenericProps {
    schema: ConfigItemCertificateSelect;
}
interface ConfigCertificateSelectState extends ConfigGenericState {
    selectOptions?: {
        label: string;
        value: string;
    }[];
}
declare class ConfigCertificateSelect extends ConfigGeneric<ConfigCertificateSelectProps, ConfigCertificateSelectState> {
    componentDidMount(): Promise<void>;
    renderItem(error: unknown, disabled: boolean): JSX.Element | null;
}
export default ConfigCertificateSelect;
