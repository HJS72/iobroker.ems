import { type JSX } from 'react';
import type { ConfigItemCertCollection } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigCertCollectionProps extends ConfigGenericProps {
    schema: ConfigItemCertCollection;
}
interface ConfigCertCollectionState extends ConfigGenericState {
    collectionsOptions?: string[];
}
declare class ConfigCertCollection extends ConfigGeneric<ConfigCertCollectionProps, ConfigCertCollectionState> {
    componentDidMount(): Promise<void>;
    renderItem(error: unknown, disabled: boolean): JSX.Element;
}
export default ConfigCertCollection;
