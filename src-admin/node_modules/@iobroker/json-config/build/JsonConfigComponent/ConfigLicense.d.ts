import { type JSX } from 'react';
import type { ConfigItemLicense } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigLicenseProps extends ConfigGenericProps {
    schema: ConfigItemLicense;
}
interface ConfigLicenseState extends ConfigGenericState {
    showLicenseDialog?: boolean;
    licenseChecked?: boolean;
    license?: string;
    loading?: boolean;
    error?: boolean;
    scrolledDown?: boolean;
}
declare class ConfigLicense extends ConfigGeneric<ConfigLicenseProps, ConfigLicenseState> {
    private readonly scrollRef;
    constructor(props: ConfigLicenseProps);
    scrolledDown(): boolean;
    componentDidMount(): void;
    renderItem(_error: string, disabled: boolean): JSX.Element | null;
}
export default ConfigLicense;
