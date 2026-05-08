import { type JSX } from 'react';
import type { ConfigItemDeviceManager } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigDeviceManagerProps extends ConfigGenericProps {
    schema: ConfigItemDeviceManager;
}
declare class ConfigDeviceManager extends ConfigGeneric<ConfigDeviceManagerProps, ConfigGenericState> {
    renderItem(): JSX.Element | null;
}
export default ConfigDeviceManager;
