import { type JSX } from 'react';
import type { ConfigItemCertificates } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigCertificatesProps extends ConfigGenericProps {
    schema: ConfigItemCertificates;
}
interface ConfigCertificatesState extends ConfigGenericState {
    certsPublicOptions?: {
        label: string;
        value: string;
    }[];
    certsChainOptions?: {
        label: string;
        value: string;
    }[];
    certsPrivateOptions?: {
        label: string;
        value: string;
    }[];
    collectionsOptions?: string[];
}
declare class ConfigCertificates extends ConfigGeneric<ConfigCertificatesProps, ConfigCertificatesState> {
    componentDidMount(): Promise<void>;
    renderItem(error: unknown, disabled: boolean): JSX.Element | null;
}
export default ConfigCertificates;
